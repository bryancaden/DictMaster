// DictMaster Worker: Gemini API routes + static-asset SPA hosting.
// Ported from server.ts (Express) in bryancaden/DictMaster.
//
// Why this file exists: the Cloudflare project is a Worker with ONLY static
// assets (no Worker code), so POST /api/gemini/* returned 405 and /api/*
// fell through to the SPA fallback. This Worker handles the API routes and
// delegates everything else to the static assets binding.
//
// Prompts, parsing, response shapes and error messages match server.ts.
// The Gemini call uses the REST API (fetch) instead of the @google/genai SDK
// so it runs cleanly in the Workers runtime with no extra dependencies.

interface Env {
ASSETS: Fetcher;
GEMINI_API_KEY?: string;
}

const OCR_MODELS = [
'gemini-3.5-flash-lite',
'gemini-2.5-flash',
'gemini-3.8-flash',
];

function jsonResponse(body: unknown, status = 200): Response {
return new Response(JSON.stringify(body), {
status,
headers: { 'Content-Type': 'application/json; charset=utf-8'},
});
}

function extractBase64(input: string): { mimeType: string; data: string} {
const trimmed = input.trim();
const marker = 'base64,';
const idx = trimmed.indexOf(marker);
if (idx!== -1) {
const header = trimmed.slice(0, idx);
const m = header.match(/data:([^;]+)/);
return {
mimeType: m? m[1]: 'image/jpeg',
data: trimmed.slice(idx + marker.length).replace(/\s/g, ''),
};
}
return { mimeType: 'image/jpeg', data: trimmed.replace(/\s/g, '')};
}

function extractJsonFromText(raw: string): any | null {
try {
return JSON.parse(raw);
} catch {
/* fall through */
}
const fenced = raw.match(/```json([\s\S]*?)```/);
if (fenced) {
try {
return JSON.parse(fenced[1]);
} catch {
/* fall through */
}
}
const start = raw.indexOf('{');
const end = raw.lastIndexOf('}');
if (start!== -1 && end > start) {
try {
return JSON.parse(raw.slice(start, end + 1));
} catch {
/* fall through */
}
}
return null;
}

// Ported from server.ts splitPassageIntoSentences (behaviour description):
// Chinese terminators 。！？；, English terminators.!? (only at end of text or
// followed by whitespace), and newlines are split points. A terminator followed
// by closing quotes absorbs those quotes into the same sentence. Each sentence
// is trimmed and stripped of leading numbering/bullets; empty ones are dropped.
function splitPassageIntoSentences(text: string): string[] {
const sentences: string[] = [];
const closingQuotes = new Set(['”', '’', '」', '』', '"', "'"]);
const stripLeading = (s: string) =>
s.trim().replace(/^[\d+.\-•*#\(\)一二三四五六七八九十、\s]+/, '');
let current = '';
for (let i = 0; i < text.length; i++) {
const ch = text[i];
current += ch;
const isCnEnd = '。！？；'.includes(ch);
const isEnEnd =
'.!?'.includes(ch) && (i === text.length - 1 || /\s/.test(text[i + 1]));
const isNewline = ch === '\n';
if (isCnEnd || isEnEnd || isNewline) {
let j = i + 1;
while (j < text.length && closingQuotes.has(text[j])) {
current += text[j];
j++;
}
i = j - 1;
const cleaned = stripLeading(current);
if (cleaned) sentences.push(cleaned);
current = '';
}
}
const tail = stripLeading(current);
if (tail) sentences.push(tail);
return sentences;
}

function normalizeContents(contents: unknown): unknown[] {
if (typeof contents === 'string') {
return [{ role: 'user', parts: [{ text: contents}]}];
}
if (Array.isArray(contents)) return contents;
return [contents];
}

// Tries each model in OCR_MODELS order until one succeeds, mirroring
// callGeminiWithFallback in server.ts. Returns the concatenated response text.
async function callGeminiWithFallback(
apiKey: string,
contents: unknown,
config: { responseMimeType: string},
): Promise<string> {
let lastError: unknown = null;
for (const model of OCR_MODELS) {
try {
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
const res = await fetch(url, {
method: 'POST',
headers: { 'Content-Type': 'application/json'},
body: JSON.stringify({
contents: normalizeContents(contents),
generationConfig: { responseMimeType: config.responseMimeType},
}),
});
const data: any = await res.json().catch(() => null);
if (!res.ok) {
throw new Error(
data?.error?.message || `Gemini API error: ${res.status}`,
);
}
const text = (data?.candidates?.[0]?.content?.parts || [])
.map((p: any) => p?.text || '')
.join('');
return text;
} catch (err) {
console.warn(`[Gemini Fallback] Model ${model} encountered error:`, err);
lastError = err;
}
}
throw lastError || new Error('所有 AI 辨識模型暫時繁忙，請稍後重試');
}

// ---------------------------------------------------------------------------
// POST /api/gemini/ocr
// ---------------------------------------------------------------------------
async function handleOcr(request: Request, env: Env): Promise<Response> {
try {
const apiKey = env.GEMINI_API_KEY;
if (!apiKey) {
return jsonResponse(
{
error: '辨識圖片失敗，請確保照片清晰且光線充足',
details: 'GEMINI_API_KEY is not configured on the server',
},
500,
);
}
const body: any = await request.json().catch(() => ({}));
const { imageBase64, language = 'auto', customInstructions} = body;
if (!imageBase64) {
return jsonResponse({ error: '請提供相片或圖片'}, 400);
}
const { mimeType, data} = extractBase64(String(imageBase64));

const prompt = `你是一位高精度 OCR 光學文字辨識與溫習默書專家。請仔細讀取這張圖片中的所有文字內容，並將圖片中的文字完整轉換為文字 (Read text from picture and convert to text)。語言偏好：${language === 'zh'? '中文（繁體/簡體/普通話/國語/粵語）': language === 'en'? '英文': '自動判斷（中文或英文）'}。${customInstructions? `額外要求：${customInstructions}`: ''} ：1. 絕不要限制句子數量（不要固定為 8 句或任何特定數量）！2. 若圖片中是一篇完整課文、文章、故事或段落 (passage)，請完整提取整篇文章全部內容，保留其完整語意、標點符號與換行，並將完整文章存入 "fullPassage"。3. ：請將圖片中所有看得到的文字依序原汁原味讀出，保留完整段落換行。4. ：為這份默書給出貼切標題（例如：課文第二篇 全文默寫 / Unit 4 Reading Passage）。5. ：- 若為段落/課文 (passage/sentences)：請依標點符號（句號、問號、驚嘆號、分號）將全部拆分成項目（無論有幾句，5句、12句、18句、25句等全部保留，不要截斷！），方便學生逐句朗讀默寫。- 若為詞語表 (words)：請提取所有詞語，不要遺漏。6. 請務必返回純 JSON 格式（不要使用額外解釋文字）：{ "rawText": "讀出的完整文字", "fullPassage": "整篇完整文章/課文內容（保留標點與段落）", "title": "建議標題", "language": "zh" 或 "en" 或 "mixed", "type": "paragraphs" 或 "sentences" 或 "words", "items": [ { "id": "1", "text": "完整第一句或詞語", "phonetic": "拼音或音標", "meaning": "釋義或翻譯", "sentence": "例句"}]} 若圖片中未發現任何文字，rawText 回傳空字串，items 回傳空陣列。`;

const responseText = await callGeminiWithFallback(
apiKey,
{ parts: [{ inlineData: { mimeType, data}}, { text: prompt}]},
{ responseMimeType: 'application/json'},
);

const parsed = extractJsonFromText(responseText);
if (parsed && typeof parsed === 'object') {
const rawText =
typeof parsed.rawText === 'string'
? parsed.rawText
: Array.isArray(parsed.items)
? parsed.items.map((it: any) => it.text).join('\n')
: '';
const fullPassage =
typeof parsed.fullPassage === 'string'? parsed.fullPassage: rawText;
const textToSplit = (fullPassage || rawText).trim();
const isPassage = /[。！？.!?]/.test(textToSplit);
let items: any[] = [];
const split = splitPassageIntoSentences(textToSplit);
if (isPassage && split.length > 1) {
items = split.map((sentence, idx) => ({
id: `sentence_${idx + 1}`,
text: sentence,
phonetic: '',
meaning: '',
sentence: '',
}));
} else if (items.length === 0 && Array.isArray(parsed.items)) {
items = parsed.items
.map((it: any, idx: number) => ({
id: it.id || `item_${idx + 1}`,
text: (it.text || it.word || '').trim(),
phonetic: it.phonetic || it.pinyin || it.jyutping || '',
meaning: it.meaning || it.definition || it.translation || '',
sentence: it.sentence || it.example || '',
}))
.filter((it: any) => it.text);
}
return jsonResponse({
rawText,
fullPassage,
title: parsed.title || '辨識出的默書清單',
language: parsed.language || (language === 'en'? 'en': 'zh'),
type: isPassage? 'sentences': parsed.type || 'words',
items,
});
}

// Parse-failure fallback: one item per non-empty line.
const lines = responseText
.split('\n')
.map((line: string) => line.trim().replace(/^[\d+.\-•*#]+\s*/, ''))
.filter(
(line: string) =>
line &&!line.startsWith('{') &&!line.startsWith('}') &&!line.includes('```'),
);
const fallbackItems = lines.map((line: string, idx: number) => ({
id: `ocr_${Date.now()}_${idx}`,
text: line,
phonetic: '',
meaning: '',
}));
return jsonResponse({
rawText: responseText,
title: '辨識出的默書清單',
language: language === 'en'? 'en': 'zh',
type: 'words',
items: fallbackItems,
});
} catch (error: any) {
console.error('OCR Endpoint Error:', error);
return jsonResponse(
{
error: '辨識圖片失敗，請確保照片清晰且光線充足',
details: error?.message || String(error),
},
500,
);
}
}

// ---------------------------------------------------------------------------
// POST /api/gemini/grade-image
// ---------------------------------------------------------------------------
async function handleGradeImage(request: Request, env: Env): Promise<Response> {
try {
const apiKey = env.GEMINI_API_KEY;
if (!apiKey) {
return jsonResponse(
{
error: '批改相片失敗，請確認照片光線充足且字跡清晰',
details: 'GEMINI_API_KEY is not configured on the server',
},
500,
);
}
const body: any = await request.json().catch(() => ({}));
const { imageBase64, items, language = 'zh', title} = body;
if (!imageBase64 ||!Array.isArray(items)) {
return jsonResponse({ error: '缺少相片或默寫題目清單'}, 400);
}
const { mimeType, data} = extractBase64(String(imageBase64));
const itemsSummary = items
.map((it: any, index: number) => `${index + 1}. [ID: ${it.id}] ${it.text}`)
.join('\n');

const prompt = `你是一位嚴謹又親切的學校默書批改老師。現在學生在一張紙上完成了默書（可能是原稿紙、田字格、單行紙或白紙），並拍下了照片。請你批改這份手寫默書作業，對照標準答案清單進行精準評分。默書標題：${title || '默書練習'} 目標語言：${language} 標準答案清單（共 ${items.length} 題）：${itemsSummary} 任務：1. 逐題尋找學生在紙上書寫的對應答案（注意學生的行數、題號或順序）。2. 辨識學生手寫內容，檢查是否有：- 中文：錯別字、漏筆劃、多筆劃、部件寫錯、形近字、同音別字、漏寫等。- 英文：拼寫錯誤 (spelling error)、大小寫錯誤、漏字母、多字母、單複數錯誤等。3. 給予具體且鼓勵性的批改意見：- 寫得好時給予表揚（如：「字體工整漂亮！」）。- 寫錯時清楚指明錯處（如：「『誠』字右邊漏了撇筆」、「spelling: 誤寫為 'definately'，正確是 'definitely'」）。4. 計算總得分（0-100分）及正確數量。5. 提供給家長與學生的整體評語 (overallFeedback)。請返回純 JSON 格式：{ "totalItems": ${items.length}, "correctCount": 數量, "score": 百分制分數, "overallFeedback": "整體評語", "results": [ { "itemId": "題目ID", "targetText": "正確字詞", "studentText": "辨識出的學生手寫內容", "isCorrect": true/false, "errorHighlight": "錯處說明", "feedback": "點評"}]}`;

const responseText = await callGeminiWithFallback(
apiKey,
{ parts: [{ inlineData: { mimeType, data}}, { text: prompt}]},
{ responseMimeType: 'application/json'},
);
const parsed = extractJsonFromText(responseText);
if (parsed && Array.isArray(parsed.results)) {
return jsonResponse(parsed);
}
throw new Error('批改結果解析失敗，請重新拍攝清晰照片');
} catch (error: any) {
console.error('Grade Image Endpoint Error:', error);
return jsonResponse(
{
error: '批改相片失敗，請確認照片光線充足且字跡清晰',
details: error?.message || String(error),
},
500,
);
}
}

// ---------------------------------------------------------------------------
// POST /api/gemini/grade-text
// ---------------------------------------------------------------------------
async function handleGradeText(request: Request, env: Env): Promise<Response> {
try {
const apiKey = env.GEMINI_API_KEY;
if (!apiKey) {
return jsonResponse(
{
error: '文字評分失敗',
details: 'GEMINI_API_KEY is not configured on the server',
},
500,
);
}
const body: any = await request.json().catch(() => ({}));
const { submissions, language = 'zh'} = body;
if (!Array.isArray(submissions)) {
return jsonResponse({ error: 'Missing submissions array'}, 400);
}

const prompt = `你是一位專業默書老師。請批改學生在線輸入的默書答案。目標語言：${language} 答案列表：${JSON.stringify(submissions, null, 2)} 要求：1. 比對每一題學生的輸入和標準答案。2. 容錯考慮：忽略前後多餘空格；如果是英文句子，檢查標點與大小寫是否合理；如果是中文詞語，字元必須精準吻合。3. 判定 isCorrect，並給出錯處分析（若是打錯字，指出哪裡拼錯或打錯）。4. 計算得分與整體評語。請返回純 JSON 格式：{ "totalItems": ${submissions.length}, "correctCount": 數量, "score": 百分制分數, "overallFeedback": "整體評語", "results": [ { "itemId": "題目ID", "targetText": "標準答案", "studentText": "學生作答", "isCorrect": true/false, "errorHighlight": "錯處說明", "feedback": "點評"}]}`;

const responseText = await callGeminiWithFallback(
apiKey,
prompt,
{ responseMimeType: 'application/json'},
);
const parsed = extractJsonFromText(responseText);
if (parsed && Array.isArray(parsed.results)) {
return jsonResponse(parsed);
}
return jsonResponse({ error: '評分解析失敗'}, 500);
} catch (error: any) {
console.error('Grade Text Endpoint Error:', error);
return jsonResponse(
{
error: '文字評分失敗',
details: error?.message || String(error),
},
500,
);
}
}

// ---------------------------------------------------------------------------
// Router: API routes first, everything else falls through to static assets.
// ---------------------------------------------------------------------------
export default {
async fetch(request: Request, env: Env): Promise<Response> {
const url = new URL(request.url);
if (request.method === 'POST' && url.pathname === '/api/gemini/ocr') {
return handleOcr(request, env);
}
if (request.method === 'POST' && url.pathname === '/api/gemini/grade-image') {
return handleGradeImage(request, env);
}
if (request.method === 'POST' && url.pathname === '/api/gemini/grade-text') {
return handleGradeText(request, env);
}
if (url.pathname === '/api/health' || url.pathname === '/health') {
return jsonResponse({ status: 'ok', timestamp: Date.now()});
}
return env.ASSETS.fetch(request);
},
};
