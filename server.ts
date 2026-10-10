import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : undefined;
const PORT = cliPort || Number(process.env.PORT) || 3000;

// Health check endpoint for container and platform readiness probes
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Support high-resolution camera photo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to safely sanitize base64 data url
function extractBase64(input: string): { data: string; mimeType: string } {
  const trimmed = input.trim();
  const base64Index = trimmed.indexOf('base64,');
  if (base64Index !== -1) {
    const header = trimmed.slice(0, base64Index);
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1].trim() : 'image/jpeg';
    const data = trimmed.slice(base64Index + 7).replace(/\s+/g, '');
    return { mimeType, data };
  }
  return { mimeType: 'image/jpeg', data: trimmed.replace(/\s+/g, '') };
}

function splitPassageIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;

    const isChineseEnd = char === '。' || char === '！' || char === '？' || char === '；';
    const isEnglishEnd =
      (char === '.' || char === '!' || char === '?') &&
      (i === text.length - 1 || /\s/.test(text[i + 1]));
    const isNewline = char === '\n';

    const nextChar = text[i + 1];
    if (
      (isChineseEnd || isEnglishEnd) &&
      (nextChar === '”' ||
        nextChar === '’' ||
        nextChar === '」' ||
        nextChar === '』' ||
        nextChar === '"' ||
        nextChar === "'")
    ) {
      current += nextChar;
      i++;
    }

    if (isChineseEnd || isEnglishEnd || isNewline) {
      const trimmed = current
        .trim()
        .replace(/^[\d+.\-•*#\(\)一二三四五六七八九十、\s]+/, '')
        .trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
      current = '';
    }
  }

  if (current.trim()) {
    const trimmed = current
      .trim()
      .replace(/^[\d+.\-•*#\(\)一二三四五六七八九十、\s]+/, '')
      .trim();
    if (trimmed.length > 0) {
      sentences.push(trimmed);
    }
  }

  return sentences;
}

// Resilient model fallback: 'gemini-3.5-flash-lite' (fastest & highly available) -> 'gemini-2.5-flash' -> 'gemini-3.8-flash'
const OCR_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.8-flash'];

async function callGeminiWithFallback(params: {
  contents: any;
  config?: any;
}) {
  let lastError: any = null;

  for (const model of OCR_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err: any) {
      console.warn(`[Gemini Fallback] Model ${model} encountered error:`, err?.message || err);
      lastError = err;
      // Continue to next available model
    }
  }

  throw lastError || new Error('所有 AI 辨識模型暫時繁忙，請稍後重試');
}

// Helper to safely parse JSON from AI response (handles markdown blocks, raw text, etc.)
function extractJsonFromText(raw: string): any {
  if (!raw) return null;
  // Try direct parse
  try {
    return JSON.parse(raw);
  } catch (_) {
    // Check for ```json ... ``` code blocks
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (_) {}
    }
    // Check for first { and last }
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      } catch (_) {}
    }
  }
  return null;
}

// 1. OCR Endpoint: Extract text from picture & convert to text and dictation items
app.post('/api/gemini/ocr', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64, language = 'auto', customInstructions } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: '請提供相片或圖片' });
      return;
    }

    const { data, mimeType } = extractBase64(imageBase64);

    const prompt = `
你是一位高精度 OCR 光學文字辨識與溫習默書專家。
請仔細讀取這張圖片中的所有文字內容，並將圖片中的文字完整轉換為文字 (Read text from picture and convert to text)。
語言偏好：${language === 'zh' ? '中文（繁體/簡體/普通話/國語/粵語）' : language === 'en' ? '英文' : '自動判斷（中文或英文）'}。
${customInstructions ? `額外要求：${customInstructions}` : ''}

【極其重要的要求】：
1. 絕不要限制句子數量（不要固定為 8 句或任何特定數量）！
2. 若圖片中是一篇完整課文、文章、故事或段落 (passage)，請完整提取整篇文章全部內容，保留其完整語意、標點符號與換行，並將完整文章存入 "fullPassage"。
3. 【完整文字轉換 rawText】：請將圖片中所有看得到的文字依序原汁原味讀出，保留完整段落換行。
4. 【標題 title】：為這份默書給出貼切標題（例如：課文第二篇 全文默寫 / Unit 4 Reading Passage）。
5. 【默寫項目 items】：
   - 若為段落/課文 (passage/sentences)：請依標點符號（句號、問號、驚嘆號、分號）將【整篇文章的所有句子】全部拆分成項目（無論有幾句，5句、12句、18句、25句等全部保留，不要截斷！），方便學生逐句朗讀默寫。
   - 若為詞語表 (words)：請提取所有詞語，不要遺漏。
6. 請務必返回純 JSON 格式（不要使用額外解釋文字）：
{
  "rawText": "讀出的完整文字",
  "fullPassage": "整篇完整文章/課文內容（保留標點與段落）",
  "title": "建議標題",
  "language": "zh" 或 "en" 或 "mixed",
  "type": "paragraphs" 或 "sentences" 或 "words",
  "items": [
    {
      "id": "1",
      "text": "完整第一句或詞語",
      "phonetic": "拼音或音標",
      "meaning": "釋義或翻譯",
      "sentence": "例句"
    }
  ]
}
若圖片中未發現任何文字，rawText 回傳空字串，items 回傳空陣列。
`;

    const response = await callGeminiWithFallback({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response?.text || '';
    const parsed = extractJsonFromText(responseText);

    if (parsed && typeof parsed === 'object') {
      const rawText = (parsed.rawText && typeof parsed.rawText === 'string')
        ? parsed.rawText
        : (Array.isArray(parsed.items) ? parsed.items.map((it: any) => it.text).join('\n') : '');

      const fullPassage = (parsed.fullPassage && typeof parsed.fullPassage === 'string')
        ? parsed.fullPassage
        : rawText;

      let items: any[] = [];
      const textToSplit = (fullPassage || rawText).trim();
      const isPassage = /[。！？.!?]/.test(textToSplit);

      if (isPassage) {
        // Enforce "一句為一題自動分拆" across the full passage
        const sentences = splitPassageIntoSentences(textToSplit);
        if (sentences.length > 1) {
          items = sentences.map((st, idx) => ({
            id: `sentence_${idx + 1}`,
            text: st,
            phonetic: '',
            meaning: '',
            sentence: '',
          }));
        }
      }

      // If not a multi-sentence passage or fallback needed, use parsed items
      if (items.length === 0 && Array.isArray(parsed.items)) {
        items = parsed.items.map((it: any, idx: number) => ({
          id: it.id || `item_${idx + 1}`,
          text: (it.text || it.word || '').trim(),
          phonetic: it.phonetic || it.pinyin || it.jyutping || '',
          meaning: it.meaning || it.definition || it.translation || '',
          sentence: it.sentence || it.example || '',
        })).filter((it: any) => it.text.length > 0);
      }

      res.json({
        rawText,
        fullPassage,
        title: parsed.title || '辨識出的默書清單',
        language: parsed.language || (language === 'en' ? 'en' : 'zh'),
        type: isPassage ? 'sentences' : (parsed.type || 'words'),
        items,
      });
      return;
    }

    // Fallback if parsing failed: parse lines directly from model's responseText
    const lines = responseText
      .split('\n')
      .map((l) => l.trim().replace(/^[\d+.\-•*#]+\s*/, ''))
      .filter((l) => l.length > 0 && !l.startsWith('{') && !l.startsWith('}') && !l.includes('```'));

    const fallbackItems = lines.map((line, idx) => ({
      id: `ocr_${Date.now()}_${idx}`,
      text: line,
      phonetic: '',
      meaning: '',
    }));

    res.json({
      rawText: responseText,
      title: '辨識出的默書清單',
      language: language === 'en' ? 'en' : 'zh',
      type: 'words',
      items: fallbackItems,
    });
  } catch (error: any) {
    console.error('OCR Endpoint Error:', error);
    res.status(500).json({
      error: '辨識圖片失敗，請確保照片清晰且光線充足',
      details: error?.message || String(error),
    });
  }
});

// 2. Photo Auto-Grading Endpoint: Compare student's handwritten sheet with target items
app.post('/api/gemini/grade-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64, items, language = 'zh', title } = req.body;
    if (!imageBase64 || !items || !Array.isArray(items)) {
      res.status(400).json({ error: '缺少相片或默寫題目清單' });
      return;
    }

    const { data, mimeType } = extractBase64(imageBase64);

    const itemsSummary = items
      .map((it: any, index: number) => `${index + 1}. [ID: ${it.id}] ${it.text}`)
      .join('\n');

    const prompt = `
你是一位嚴謹又親切的學校默書批改老師。
現在學生在一張紙上完成了默書（可能是原稿紙、田字格、單行紙或白紙），並拍下了照片。
請你批改這份手寫默書作業，對照標準答案清單進行精準評分。

默書標題：${title || '默書練習'}
目標語言：${language}
標準答案清單（共 ${items.length} 題）：
${itemsSummary}

任務：
1. 逐題尋找學生在紙上書寫的對應答案（注意學生的行數、題號或順序）。
2. 辨識學生手寫內容，檢查是否有：
   - 中文：錯別字、漏筆劃、多筆劃、部件寫錯、形近字、同音別字、漏寫等。
   - 英文：拼寫錯誤 (spelling error)、大小寫錯誤、漏字母、多字母、單複數錯誤等。
3. 給予具體且鼓勵性的批改意見：
   - 寫得好時給予表揚（如：「字體工整漂亮！」）。
   - 寫錯時清楚指明錯處（如：「『誠』字右邊漏了撇筆」、「spelling: 誤寫為 'definately'，正確是 'definitely'」）。
4. 計算總得分（0-100分）及正確數量。
5. 提供給家長與學生的整體評語 (overallFeedback)。

請返回純 JSON 格式：
{
  "totalItems": ${items.length},
  "correctCount": 數量,
  "score": 百分制分數,
  "overallFeedback": "整體評語",
  "results": [
    {
      "itemId": "題目ID",
      "targetText": "正確字詞",
      "studentText": "辨識出的學生手寫內容",
      "isCorrect": true/false,
      "errorHighlight": "錯處說明",
      "feedback": "點評"
    }
  ]
}
`;

    const response = await callGeminiWithFallback({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response?.text || '';
    const parsed = extractJsonFromText(responseText);

    if (parsed && Array.isArray(parsed.results)) {
      res.json(parsed);
      return;
    }

    throw new Error('批改結果解析失敗，請重新拍攝清晰照片');
  } catch (error: any) {
    console.error('Grade Image Error:', error);
    res.status(500).json({
      error: '批改相片失敗，請確認照片光線充足且字跡清晰',
      details: error?.message || String(error),
    });
  }
});

// 3. Digital Grading Endpoint: Compare text input with target items
app.post('/api/gemini/grade-text', async (req: Request, res: Response): Promise<void> => {
  try {
    const { submissions, language = 'zh' } = req.body;
    if (!submissions || !Array.isArray(submissions)) {
      res.status(400).json({ error: 'Missing submissions array' });
      return;
    }

    const prompt = `
你是一位專業默書老師。請批改學生在線輸入的默書答案。
目標語言：${language}

答案列表：
${JSON.stringify(submissions, null, 2)}

要求：
1. 比對每一題學生的輸入和標準答案。
2. 容錯考慮：忽略前後多餘空格；如果是英文句子，檢查標點與大小寫是否合理；如果是中文詞語，字元必須精準吻合。
3. 判定 isCorrect，並給出錯處分析（若是打錯字，指出哪裡拼錯或打錯）。
4. 計算得分與整體評語。

請返回純 JSON 格式：
{
  "totalItems": ${submissions.length},
  "correctCount": 數量,
  "score": 百分制分數,
  "overallFeedback": "整體評語",
  "results": [
    {
      "itemId": "題目ID",
      "targetText": "標準答案",
      "studentText": "學生作答",
      "isCorrect": true/false,
      "errorHighlight": "錯處說明",
      "feedback": "點評"
    }
  ]
}
`;

    const response = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response?.text || '';
    const parsed = extractJsonFromText(responseText);

    if (parsed && Array.isArray(parsed.results)) {
      res.json(parsed);
      return;
    }

    // Client fallback will be used if server fails
    res.status(500).json({ error: '評分解析失敗' });
  } catch (error: any) {
    console.error('Grade Text Error:', error);
    res.status(500).json({
      error: '文字評分失敗',
      details: error?.message || String(error),
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dictation App Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
