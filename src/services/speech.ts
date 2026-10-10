import { VoiceDialect } from '../types/dictation';

// Priority keywords for Chinese Putonghua/Mandarin gentle lady voices
const MANDARIN_LADY_VOICE_KEYWORDS = [
  'xiaoxiao', // Microsoft Xiaoxiao (Natural female)
  'tingting', // Apple Ting-Ting (Female)
  'ting-ting',
  'mei-jia',  // Apple Mei-Jia (Female)
  'meijia',
  'yaoyao',   // Microsoft Yaoyao (Female)
  'huihui',   // Microsoft Huihui (Female)
  'xiaoyi',   // Microsoft Xiaoyi (Female)
  'lili',
  'sin-ji',
  'google 普通话',
  'google 國語',
  'cmn-hans-cn',
  'zh-cmn-hans',
  'female',
  'woman',
];

const CANTONESE_LADY_VOICE_KEYWORDS = [
  'sin-ji',
  'sinji',
  'hiugaam',
  'hiu-gaam',
  'hiumaan',
  'hiu-maan',
  'google 粤语',
  'cantonese',
  'zh-hk',
];

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private onVoicesChangedCallbacks: Array<() => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
          this.onVoicesChangedCallbacks.forEach((cb) => cb());
        };
      }
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  public onVoicesLoaded(callback: () => void) {
    this.onVoicesChangedCallbacks.push(callback);
    if (this.voices.length > 0) {
      callback();
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.synth) {
      this.loadVoices();
    }
    return this.voices;
  }

  public getBestVoice(language: 'zh' | 'en' | string, dialect?: VoiceDialect): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    if (voices.length === 0) return null;

    // 1. Cantonese (zh-HK)
    if (dialect === 'zh-HK') {
      const cantoneseVoices = voices.filter(
        (v) =>
          v.lang.toLowerCase().includes('hk') ||
          v.lang.toLowerCase().includes('yue') ||
          v.name.toLowerCase().includes('cantonese') ||
          v.name.toLowerCase().includes('hong kong')
      );

      for (const kw of CANTONESE_LADY_VOICE_KEYWORDS) {
        const found = cantoneseVoices.find((v) => v.name.toLowerCase().includes(kw));
        if (found) return found;
      }

      if (cantoneseVoices.length > 0) return cantoneseVoices[0];
    }

    // 2. Mandarin / Putonghua (zh-CN or zh-TW): Strongly prefer gentle lady voice
    if (dialect === 'zh-CN' || dialect === 'zh-TW' || language === 'zh') {
      const mandarinVoices = voices.filter(
        (v) =>
          v.lang.toLowerCase().startsWith('zh-cn') ||
          v.lang.toLowerCase().startsWith('zh-cmn') ||
          v.lang.toLowerCase().startsWith('zh-tw') ||
          v.lang.toLowerCase().startsWith('zh-hans') ||
          (v.lang.toLowerCase().startsWith('zh') && !v.lang.toLowerCase().includes('hk'))
      );

      // Search for top lady voice keywords first
      for (const kw of MANDARIN_LADY_VOICE_KEYWORDS) {
        const found = mandarinVoices.find((v) => v.name.toLowerCase().includes(kw));
        if (found) return found;
      }

      // Filter out explicitly male voices if possible
      const nonMale = mandarinVoices.find(
        (v) =>
          !v.name.toLowerCase().includes('male') &&
          !v.name.toLowerCase().includes('kangkang') &&
          !v.name.toLowerCase().includes('yunjian') &&
          !v.name.toLowerCase().includes('yunxi')
      );
      if (nonMale) return nonMale;

      if (mandarinVoices.length > 0) return mandarinVoices[0];
    }

    // 3. English (en-GB or en-US)
    if (language === 'en' || dialect?.startsWith('en')) {
      const isGB = dialect === 'en-GB';
      const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));

      if (isGB) {
        const gbVoice = enVoices.find((v) => v.lang.toLowerCase().includes('gb') || v.lang.toLowerCase().includes('uk'));
        if (gbVoice) return gbVoice;
      }

      // Prefer natural female English voices (Samantha, Victoria, Karen, Google US English)
      const femaleEn = enVoices.find(
        (v) =>
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('samantha') ||
          v.name.toLowerCase().includes('victoria') ||
          v.name.toLowerCase().includes('karen') ||
          v.name.toLowerCase().includes('natural')
      );
      if (femaleEn) return femaleEn;

      if (enVoices.length > 0) return enVoices[0];
    }

    // Fallback
    const exactLang = voices.find((v) => dialect && v.lang.toLowerCase() === dialect.toLowerCase());
    if (exactLang) return exactLang;

    return voices.find((v) => v.lang.startsWith(language)) || null;
  }

  public speak(options: {
    text: string;
    lang?: string;
    dialect?: VoiceDialect;
    rate?: number;
    pitch?: number;
    voiceURI?: string;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }): void {
    if (!this.synth) {
      options.onError?.(new Error('Speech Synthesis not supported in this browser'));
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(options.text);
    this.currentUtterance = utterance;

    // Dictation speed default 0.9x for clear articulation
    utterance.rate = options.rate ?? 0.9;

    const voices = this.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (options.voiceURI) {
      selectedVoice = voices.find((v) => v.voiceURI === options.voiceURI) || null;
    }

    if (!selectedVoice) {
      const isEnglish = /^[A-Za-z0-9\s.,!?'"()-]+$/.test(options.text.trim());
      const langHint = options.lang || (isEnglish ? 'en' : 'zh');
      selectedVoice = this.getBestVoice(langHint, options.dialect);
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = options.dialect || (options.lang === 'en' ? 'en-US' : 'zh-CN');
    }

    // Putonghua gentle lady voice tuning:
    // If dialect is zh-CN or zh-TW, set pitch to a pleasant 1.08 - 1.12 to ensure feminine clarity
    const isPutonghua =
      options.dialect === 'zh-CN' ||
      options.dialect === 'zh-TW' ||
      (selectedVoice && selectedVoice.lang.startsWith('zh') && !selectedVoice.lang.includes('hk'));

    if (isPutonghua) {
      // Natural lady pitch
      utterance.pitch = options.pitch ?? 1.1;
    } else {
      utterance.pitch = options.pitch ?? 1.0;
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('Speech error:', e);
        options.onError?.(e);
      }
    };

    try {
      this.synth.speak(utterance);
    } catch (err) {
      options.onError?.(err);
    }
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return !!this.synth?.speaking;
  }

  // Audio tone generator for kid-friendly gentle cues
  public playChime(type: 'ding' | 'success' | 'alert' = 'ding') {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'ding') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'alert') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(330, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      // AudioContext may be blocked before interaction, safe to ignore
    }
  }
}

export const speechService = new SpeechService();
