export type LanguageType = 'zh' | 'en' | 'mixed';
export type VoiceDialect = 'zh-HK' | 'zh-TW' | 'zh-CN' | 'en-US' | 'en-GB';

export interface DictationItem {
  id: string;
  text: string;
  phonetic?: string; // Pinyin / Jyutping / IPA
  meaning?: string; // Definition / translation
  sentence?: string; // Example sentence
}

export interface DictationSet {
  id: string;
  title: string;
  language: LanguageType;
  type: 'words' | 'sentences' | 'paragraphs';
  items: DictationItem[];
  fullPassage?: string; // The whole passage of the uploaded picture or article
  notes?: string;
  createdAt: number;
  lastPracticedAt?: number;
  bestScore?: number;
}

export interface ItemGradingResult {
  itemId: string;
  targetText: string;
  studentText?: string;
  isCorrect: boolean;
  errorHighlight?: string;
  feedback?: string;
}

export interface DictationGradingReport {
  id: string;
  setId: string;
  setTitle: string;
  language: LanguageType;
  date: number;
  mode: 'digital' | 'photo' | 'self-check';
  totalItems: number;
  correctCount: number;
  score: number; // 0 - 100
  overallFeedback: string;
  results: ItemGradingResult[];
  photoDataUrl?: string; // If submitted via photo
}

export interface DictationSettings {
  speechRate: number; // 0.6 - 1.4, default 0.9
  repeatCount: number; // 1, 2, 3, default 2
  intervalSeconds: number; // 3, 5, 8, 10, default 6
  autoAdvance: boolean; // whether to automatically advance after interval
  readMeaning: boolean; // read definition/hint after word
  soundEffects: boolean; // cheerful UI sound effects
  preferredVoice: string; // voice URI or dialect
}

export interface MistakeItem extends DictationItem {
  failedCount: number;
  lastFailedDate: number;
  fromSetTitle: string;
  fromSetId: string;
  language: LanguageType;
}
