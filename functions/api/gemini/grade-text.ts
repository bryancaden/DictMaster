// POST /api/gemini/grade-text — typed-answer marking.
// Cloudflare Pages Function ported 1:1 from server.ts in bryancaden/DictMaster.
import {
  callGeminiWithFallback,
  extractJsonFromText,
  jsonResponse,
} from './_shared';

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const apiKey = context.env.GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      return jsonResponse(
        {
          error: '文字評分失敗',
          details: 'GEMINI_API_KEY is not configured on the server',
        },
        500,
      );
    }
    const body: any = await context.request.json().catch(() => ({}));
    const { submissions, language = 'zh' } = body;
    if (!Array.isArray(submissions)) {
      return jsonResponse({ error: 'Missing submissions array' }, 400);
    }

    const prompt = `你是一位專業默書老師。請批改學生在線輸入的默書答案。目標語言：${language} 答案列表：${JSON.stringify(submissions, null, 2)} 要求：1. 比對每一題學生的輸入和標準答案。2. 容錯考慮：忽略前後多餘空格；如果是英文句子，檢查標點與大小寫是否合理；如果是中文詞語，字元必須精準吻合。3. 判定 isCorrect，並給出錯處分析（若是打錯字，指出哪裡拼錯或打錯）。4. 計算得分與整體評語。請返回純 JSON 格式：{ "totalItems": ${submissions.length}, "correctCount": 數量, "score": 百分制分數, "overallFeedback": "整體評語", "results": [ { "itemId": "題目ID", "targetText": "標準答案", "studentText": "學生作答", "isCorrect": true/false, "errorHighlight": "錯處說明", "feedback": "點評" } ] }`;

    const responseText = await callGeminiWithFallback(
      apiKey,
      prompt,
      { responseMimeType: 'application/json' },
    );
    const parsed = extractJsonFromText(responseText);
    if (parsed && Array.isArray(parsed.results)) {
      return jsonResponse(parsed);
    }
    return jsonResponse({ error: '評分解析失敗' }, 500);
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
