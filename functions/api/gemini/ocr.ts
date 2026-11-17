// POST /api/gemini/ocr — photo OCR for dictation lists.
// Cloudflare Pages Function ported 1:1 from server.ts in bryancaden/DictMaster.
import {
callGeminiWithFallback,
extractBase64,
extractJsonFromText,
splitPassageIntoSentences,
jsonResponse,
} from './_shared';

export async function onRequestPost(context: any): Promise<Response> {
try {
const apiKey = context.env.GEMINI_API_KEY as string | undefined;
if (!apiKey) {
return jsonResponse(
{
error: '辨識圖片失敗，請確保照片清晰且光線充足',
details: 'GEMINI_API_KEY is not configured on the server',
},
500,
);
}
const body: any = await context.request.json().catch(() => ({}));
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
