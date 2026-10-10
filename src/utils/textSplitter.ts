/**
 * Sentence and vocabulary splitting utilities for dictation practice.
 * Ensures "一句為一題" (one sentence per item) splitting across full passages.
 */

export function splitPassageIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;

    // Chinese sentence enders
    const isChineseEnd = char === '。' || char === '！' || char === '？' || char === '；';
    
    // English sentence enders (followed by space, newline, or end of string)
    const isEnglishEnd =
      (char === '.' || char === '!' || char === '?') &&
      (i === text.length - 1 || /\s/.test(text[i + 1]));

    const isNewline = char === '\n';

    // If next character is a closing quote or bracket, include it in the sentence
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
      // Strip leading numbering like "1. ", "(1) ", "一、", etc.
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

  // Any remaining tail text
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

export function splitTextIntoWords(text: string): string[] {
  if (!text || !text.trim()) return [];

  return text
    .split(/[\n,，、\t]+/)
    .map((w) => w.trim().replace(/^[\d+.\-•*#\(\)一二三四五六七八九十、\s]+/, '').trim())
    .filter((w) => w.length > 0);
}
