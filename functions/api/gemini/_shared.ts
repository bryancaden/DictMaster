// Shared helpers for DictMaster Gemini Pages Functions.
// Ported from server.ts (Express) in bryancaden/DictMaster.
// NOTE: the Gemini call uses the REST API (fetch) instead of the @google/genai
// SDK so it runs cleanly in the Cloudflare Workers runtime with no extra deps.
// Prompts, parsing, response shapes and error messages match server.ts.

export const OCR_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.8-flash',
];

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function extractBase64(input: string): { mimeType: string; data: string } {
  const trimmed = input.trim();
  const marker = 'base64,';
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const header = trimmed.slice(0, idx);
    const m = header.match(/data:([^;]+)/);
    return {
      mimeType: m ? m[1] : 'image/jpeg',
      data: trimmed.slice(idx + marker.length).replace(/\s/g, ''),
    };
  }
  return { mimeType: 'image/jpeg', data: trimmed.replace(/\s/g, '') };
}

export function extractJsonFromText(raw: string): any | null {
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
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

// Ported from server.ts splitPassageIntoSentences (behaviour description):
// Chinese terminators 。！？；, English terminators .!? (only at end of text or
// followed by whitespace), and newlines are split points. A terminator followed
// by closing quotes absorbs those quotes into the same sentence. Each sentence
// is trimmed and stripped of leading numbering/bullets; empty ones are dropped.
export function splitPassageIntoSentences(text: string): string[] {
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
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  if (Array.isArray(contents)) return contents;
  return [contents];
}

// Tries each model in OCR_MODELS order until one succeeds, mirroring
// callGeminiWithFallback in server.ts. Returns the concatenated response text.
export async function callGeminiWithFallback(
  apiKey: string,
  contents: unknown,
  config: { responseMimeType: string },
): Promise<string> {
  let lastError: unknown = null;
  for (const model of OCR_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: normalizeContents(contents),
          generationConfig: { responseMimeType: config.responseMimeType },
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
