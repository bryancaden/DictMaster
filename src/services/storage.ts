import { DictationSet, DictationGradingReport, MistakeItem, DictationSettings } from '../types/dictation';

const STORAGE_KEYS = {
  SETS: 'dictation_pal_sets',
  ACTIVE_SET_ID: 'dictation_pal_active_set_id',
  MISTAKES: 'dictation_pal_mistakes',
  HISTORY: 'dictation_pal_history',
  SETTINGS: 'dictation_pal_settings',
};

export const DEFAULT_SETTINGS: DictationSettings = {
  speechRate: 0.9,
  repeatCount: 2,
  intervalSeconds: 6,
  autoAdvance: true,
  readMeaning: false,
  soundEffects: true,
  preferredVoice: 'zh-HK',
};

// Preset sample dictation sets for immediate testing and convenience
export const PRESET_SETS: DictationSet[] = [
  {
    id: 'preset_zh_p3_1',
    title: '三年級中文 - 詞語默寫（品格與日常生活）',
    language: 'zh',
    type: 'words',
    notes: '小學常見常考詞語，注意筆劃部件',
    createdAt: Date.now() - 86400000 * 2,
    items: [
      { id: 'zh1', text: '誠實', phonetic: 'chéng shí / sing4 sat6', meaning: '不虛假、不說謊', sentence: '做人要誠實，才能贏得信任。' },
      { id: 'zh2', text: '謙虛', phonetic: 'qiān xū / him1 heoi1', meaning: '虛心不自滿', sentence: '即使拿到第一名，他依然十分謙虛。' },
      { id: 'zh3', text: '堅持', phonetic: 'jiān chí / gin1 ci4', meaning: '堅決保持不放棄', sentence: '只要堅持努力，夢想終會實現。' },
      { id: 'zh4', text: '勇敢', phonetic: 'yǒng gǎn / jung2 gam2', meaning: '有膽量、不退縮', sentence: '消防員勇敢地衝進火場救人。' },
      { id: 'zh5', text: '熱心', phonetic: 'rè xīn / jit6 sam1', meaning: '熱情主動助人', sentence: '班長總是熱心幫助有困難的同學。' },
      { id: 'zh6', text: '觀察', phonetic: 'guān chá / gun1 caat3', meaning: '仔細察看事物', sentence: '科學課上，我們仔細觀察植物生長。' },
      { id: 'zh7', text: '探索', phonetic: 'tàn suǒ / taam3 sok3', meaning: '尋求發掘未知', sentence: '太空人不斷探索浩瀚的宇宙。' },
      { id: 'zh8', text: '團結', phonetic: 'tuán jié / tyun4 git3', meaning: '齊心協力', sentence: '大家團結一致，順利完成了話劇表演。' },
    ],
  },
  {
    id: 'preset_en_p4_1',
    title: 'Primary 4 English - Vocabulary & Spelling List',
    language: 'en',
    type: 'words',
    notes: 'Essential school & daily life vocabulary with phonetics',
    createdAt: Date.now() - 86400000,
    items: [
      { id: 'en1', text: 'adventure', phonetic: '/ədˈventʃə(r)/', meaning: '冒險、奇遇', sentence: 'They had an exciting adventure in the jungle.' },
      { id: 'en2', text: 'delicious', phonetic: '/dɪˈlɪʃəs/', meaning: '美味的、可口的', sentence: 'My mother baked a delicious chocolate cake.' },
      { id: 'en3', text: 'environment', phonetic: '/ɪnˈvaɪrənmənt/', meaning: '環境、自然界', sentence: 'We should protect our school environment.' },
      { id: 'en4', text: 'generous', phonetic: '/ˈdʒenərəs/', meaning: '慷慨的、大方的', sentence: 'He is generous and often shares his toys.' },
      { id: 'en5', text: 'mysterious', phonetic: '/mɪˈstɪəriəs/', meaning: '神秘的', sentence: 'There was a mysterious sound behind the door.' },
      { id: 'en6', text: 'restaurant', phonetic: '/ˈrestrɒnt/', meaning: '餐館、餐廳', sentence: 'We celebrated his birthday at an Italian restaurant.' },
      { id: 'en7', text: 'temperature', phonetic: '/ˈtemprətʃə(r)/', meaning: '溫度、氣溫', sentence: 'The temperature dropped significantly tonight.' },
      { id: 'en8', text: 'necessary', phonetic: '/ˈnesəsəri/', meaning: '必要的、必需的', sentence: 'Drinking water is necessary for good health.' },
    ],
  },
  {
    id: 'preset_zh_passage',
    title: '三年級中文 - 課文全文段落默寫《美麗的海灘》',
    language: 'zh',
    type: 'paragraphs',
    notes: '課文完整段落，適合練習全文段落默寫與標點符號運用',
    fullPassage: '夏天的海灘真是一個美麗迷人的地方。金黃色的沙灘在陽光下閃爍著耀眼的光芒，柔軟得像地毯一樣。蔚藍色的大海翻滾著雪白的浪花，一層一層輕輕拍打著岸邊。海鷗在蔚藍的天空中自由自在地翱翔，發出清脆歡快的叫聲。海邊的孩子們有的忙著堆沙堡，有的在海浪裡歡笑嬉戲。微風吹來陣陣涼爽的海水氣息，令人心曠神怡，久久不願離去。',
    createdAt: Date.now() - 3600000 * 2,
    items: [
      { id: 'p1', text: '夏天的海灘真是一個美麗迷人的地方。' },
      { id: 'p2', text: '金黃色的沙灘在陽光下閃爍著耀眼的光芒，柔軟得像地毯一樣。' },
      { id: 'p3', text: '蔚藍色的大海翻滾著雪白的浪花，一層一層輕輕拍打著岸邊。' },
      { id: 'p4', text: '海鷗在蔚藍的天空中自由自在地翱翔，發出清脆歡快的叫聲。' },
      { id: 'p5', text: '海邊的孩子們有的忙著堆沙堡，有的在海浪裡歡笑嬉戲。' },
      { id: 'p6', text: '微風吹來陣陣涼爽的海水氣息，令人心曠神怡，久久不願離去。' },
    ],
  },
  {
    id: 'preset_zh_sentences',
    title: '小學中文 - 實用好句默寫（寫作素材）',
    language: 'zh',
    type: 'sentences',
    notes: '優美句子默寫，注意標點符號與字形',
    createdAt: Date.now() - 3600000 * 5,
    items: [
      { id: 's1', text: '微風輕輕吹過，湖面上泛起陣陣漣漪。', phonetic: '', meaning: '景物描寫', sentence: '' },
      { id: 's2', text: '書山有路勤為徑，學海無涯苦作舟。', phonetic: '', meaning: '勉勵讀書名句', sentence: '' },
      { id: 's3', text: '經過一番思考，他終於解開了這道難題。', phonetic: '', meaning: '敘事描寫', sentence: '' },
      { id: 's4', text: '失敗乃成功之母，只要不放棄就充滿希望。', phonetic: '', meaning: '哲理名言', sentence: '' },
    ],
  },
];

export const storageService = {
  getSets(): DictationSet[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(PRESET_SETS));
        return PRESET_SETS;
      }
      return JSON.parse(raw);
    } catch {
      return PRESET_SETS;
    }
  },

  saveSets(sets: DictationSet[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
    } catch (e) {
      console.error('Failed to save sets', e);
    }
  },

  saveSet(set: DictationSet): void {
    const sets = this.getSets();
    const index = sets.findIndex((s) => s.id === set.id);
    if (index >= 0) {
      sets[index] = set;
    } else {
      sets.unshift(set);
    }
    this.saveSets(sets);
  },

  deleteSet(id: string): void {
    const sets = this.getSets().filter((s) => s.id !== id);
    this.saveSets(sets);
  },

  getActiveSetId(): string {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SET_ID) || PRESET_SETS[0].id;
  },

  setActiveSetId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SET_ID, id);
  },

  getMistakes(): MistakeItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MISTAKES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addMistakes(items: Array<{ item: { id: string; text: string; phonetic?: string; meaning?: string; sentence?: string }; setTitle: string; setId: string; language: any }>): void {
    const current = this.getMistakes();
    for (const entry of items) {
      const existing = current.find((m) => m.text.trim().toLowerCase() === entry.item.text.trim().toLowerCase());
      if (existing) {
        existing.failedCount += 1;
        existing.lastFailedDate = Date.now();
        existing.fromSetTitle = entry.setTitle;
      } else {
        current.unshift({
          id: entry.item.id || 'mistake_' + Date.now() + Math.random(),
          text: entry.item.text,
          phonetic: entry.item.phonetic,
          meaning: entry.item.meaning,
          sentence: entry.item.sentence,
          failedCount: 1,
          lastFailedDate: Date.now(),
          fromSetTitle: entry.setTitle,
          fromSetId: entry.setId,
          language: entry.language,
        });
      }
    }
    try {
      localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(current));
    } catch (e) {
      console.error('Failed to save mistakes', e);
    }
  },

  removeMistake(text: string): void {
    const current = this.getMistakes().filter((m) => m.text.trim().toLowerCase() !== text.trim().toLowerCase());
    try {
      localStorage.setItem(STORAGE_KEYS.MISTAKES, JSON.stringify(current));
    } catch (e) {
      console.error(e);
    }
  },

  clearMistakes(): void {
    localStorage.removeItem(STORAGE_KEYS.MISTAKES);
  },

  getHistory(): DictationGradingReport[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveHistoryReport(report: DictationGradingReport): void {
    const history = this.getHistory();
    history.unshift(report);
    // keep max 50
    if (history.length > 50) history.pop();
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error(e);
    }

    // Also update best score on set
    const sets = this.getSets();
    const set = sets.find((s) => s.id === report.setId);
    if (set) {
      set.lastPracticedAt = Date.now();
      if (!set.bestScore || report.score > set.bestScore) {
        set.bestScore = report.score;
      }
      this.saveSets(sets);
    }
  },

  getSettings(): DictationSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: DictationSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  },
};
