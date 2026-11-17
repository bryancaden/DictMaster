// POST /api/gemini/grade-image — photo handwriting auto-marking.
// Cloudflare Pages Function ported 1:1 from server.ts in bryancaden/DictMaster.
import {
  callGeminiWithFallback,
  extractBase64,
  extractJsonFromText,
  jsonResponse,
} from './_shared';

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const apiKey = context.env.GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      return jsonResponse(
        {
          error: '批改相片失敗，請確認照片光線充足且字跡清晰',
          details: 'GEMINI_API_KEY is not configured on the server',
        },
        500,
      );
    }
    const body: any = await context.request.json().catch(() => ({}));
    const { imageBase64, items, language = 'zh', title } = body;
    if (!imageBase64 || !Array.isArray(items)) {
      return jsonResponse({ error: '缺少相片或默寫題目清單' }, 400);
    }
    const { mimeType, data } = extractBase64(String(imageBase64));
    const itemsSummary = items
      .map((it: any, index: number) => `${index + 1}. [ID: ${it.id}] ${it.text}`)
      .join('\n');

    const prompt = `你是一位嚴謹又親切的學校默書批改老師。現在學生在一張紙上完成了默書（可能是原稿紙、田字格、單行紙或白紙），並拍下了照片。請你批改這份手寫默書作業，對照標準答案清單進行精準評分。默書標題：${title || '默書練習'} 目標語言：${language} 標準答案清單（共 ${items.length} 題）：${itemsSummary} 任務：1. 逐題尋找學生在紙上書寫的對應答案（注意學生的行數、題號或順序）。2. 辨識學生手寫內容，檢查是否有：- 中文：錯別字、漏筆劃、多筆劃、部件寫錯、形近字、同音別字、漏寫等。- 英文：拼寫錯誤 (spelling error)、大小寫錯誤、漏字母、多字母、單複數錯誤等。3. 給予具體且鼓勵性的批改意見：- 寫得好時給予表揚（如：「字體工整漂亮！」）。- 寫錯時清楚指明錯處（如：「『誠』字右邊漏了撇筆」、「spelling: 誤寫為 'definately'，正確是 'definitely'」）。4. 計算總得分（0-100分）及正確數量。5. 提供給家長與學生的整體評語 (overallFeedback)。請返回純 JSON 格式：{ "totalItems": ${items.length}, "correctCount": 數量, "score": 百分制分數, "overallFeedback": "整體評語", "results": [ { "itemId": "題目ID", "targetText": "正確字詞", "studentText": "辨識出的學生手寫內容", "isCorrect": true/false, "errorHighlight": "錯處說明", "feedback": "點評" } ] }`;

    const responseText = await callGeminiWithFallback(
      apiKey,
      { parts: [{ inlineData: { mimeType, data } }, { text: prompt }] },
      { responseMimeType: 'application/json' },
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
