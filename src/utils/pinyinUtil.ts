import { pinyin } from 'pinyin-pro';

/**
 * Converts Chinese text/sentences to standard Guoyu/Mandarin Pinyin with tone marks.
 */
export function getMandarinPinyin(text: string): string {
  if (!text || !text.trim()) return '';

  // Check if text contains Chinese characters
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  if (!hasChinese) return '';

  try {
    return pinyin(text.trim(), {
      toneType: 'symbol', // ā á ǎ à
      type: 'string',
    });
  } catch (err) {
    console.warn('Pinyin conversion error:', err);
    return '';
  }
}

export interface CharacterPinyinPair {
  char: string;
  pinyin: string;
  isZh: boolean;
}

/**
 * Returns character-pinyin paired tokens with context-aware pronunciation.
 */
export function getCharacterPinyinPairs(text: string): CharacterPinyinPair[] {
  if (!text || !text.trim()) return [];

  try {
    const tokens = pinyin(text.trim(), {
      type: 'all',
      toneType: 'symbol',
    });

    if (Array.isArray(tokens)) {
      return tokens.map((t: any) => ({
        char: t.origin,
        pinyin: t.isZh ? t.result : '',
        isZh: !!t.isZh,
      }));
    }
  } catch (err) {
    console.warn('Pinyin tokenization error:', err);
  }

  // Fallback to simple split
  const chars = Array.from(text);
  return chars.map((char) => {
    const isZh = /[\u4e00-\u9fa5]/.test(char);
    return {
      char,
      pinyin: isZh ? pinyin(char, { toneType: 'symbol' }) : '',
      isZh,
    };
  });
}
