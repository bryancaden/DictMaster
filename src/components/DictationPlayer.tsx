import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Volume2,
  Camera,
  Edit3,
  CheckCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  AlignLeft,
  ListOrdered,
  ZoomIn,
} from 'lucide-react';
import { DictationSet, DictationSettings, VoiceDialect } from '../types/dictation';
import { speechService } from '../services/speech';
import { getMandarinPinyin, getCharacterPinyinPairs } from '../utils/pinyinUtil';

interface DictationPlayerProps {
  set: DictationSet;
  settings: DictationSettings;
  activeDialect: VoiceDialect;
  onStartPhotoSubmission: () => void;
  onStartDigitalTest: () => void;
  onSelfCheckComplete: (results: Array<{ itemId: string; targetText: string; isCorrect: boolean }>) => void;
}

export const DictationPlayer: React.FC<DictationPlayerProps> = ({
  set,
  settings,
  activeDialect,
  onStartPhotoSubmission,
  onStartDigitalTest,
  onSelfCheckComplete,
}) => {
  // Determine if this set is primarily a passage or sentences
  const isPassageLike =
    set.type === 'paragraphs' ||
    set.type === 'sentences' ||
    !!set.fullPassage ||
    set.items.some((it) => it.text.length > 18);

  const [playerTab, setPlayerTab] = useState<'passage' | 'dictation' | 'study'>(
    isPassageLike ? 'passage' : 'dictation'
  );

  // For item-by-item mode
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatRound, setRepeatRound] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);
  // Font magnification in sentence-by-sentence dictation (defaults to 2x as requested)
  const [dictationFontScale, setDictationFontScale] = useState<'normal' | '2x' | '3x'>('2x');

  // For whole passage mode
  const [passagePlaying, setPassagePlaying] = useState(false);
  const [passageSentenceIndex, setPassageSentenceIndex] = useState<number>(-1);
  const [passageMode, setPassageMode] = useState<'continuous' | 'dictation_paced'>('dictation_paced');
  const [showPassageText, setShowPassageText] = useState(true);
  const [showPassagePinyin, setShowPassagePinyin] = useState(false);

  // Self check state
  const [selfChecks, setSelfChecks] = useState<Record<string, boolean>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const passagePlayingRef = useRef(passagePlaying);
  passagePlayingRef.current = passagePlaying;

  // Extract all sentences from fullPassage or items without limiting to 8!
  const passageSentences = React.useMemo(() => {
    if (set.fullPassage && set.fullPassage.trim().length > 0) {
      // Split by sentence punctuation: 。！？.!?\n
      const rawSentences = set.fullPassage
        .split(/([。！？.!?\n]+)/)
        .reduce((acc: string[], cur, idx, arr) => {
          if (idx % 2 === 0 && cur.trim()) {
            const punct = (arr[idx + 1] || '').trim();
            acc.push(cur.trim() + (punct === '\n' ? '。' : punct));
          }
          return acc;
        }, []);

      if (rawSentences.length > 0) return rawSentences;
    }
    return set.items.map((i) => i.text);
  }, [set.fullPassage, set.items]);

  const currentItem = set.items[currentIndex] || set.items[0];

  const hasChinese = currentItem ? /[\u4e00-\u9fa5]/.test(currentItem.text) : false;
  const currentMandarinPinyin = currentItem && hasChinese ? getMandarinPinyin(currentItem.text) : '';
  const currentPinyinPairs = currentItem && hasChinese ? getCharacterPinyinPairs(currentItem.text) : [];

  // Stop audio on unmount or tab change
  useEffect(() => {
    return () => {
      speechService.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playerTab]);

  // Read current item in item-by-item mode
  const speakCurrent = (onFinished?: () => void) => {
    if (!currentItem) return;
    setIsSpeakingNow(true);

    const isEnglish = set.language === 'en';
    const prefix = isEnglish ? `Number ${currentIndex + 1}. ` : `第 ${currentIndex + 1} 題。`;
    const textToSpeak = `${repeatRound === 1 && set.type === 'words' ? prefix : ''}${currentItem.text}`;

    speechService.speak({
      text: textToSpeak,
      dialect: activeDialect,
      lang: isEnglish ? 'en' : 'zh',
      rate: settings.speechRate,
      onEnd: () => {
        setIsSpeakingNow(false);
        if (settings.readMeaning && currentItem.meaning && repeatRound === 1) {
          speechService.speak({
            text: currentItem.meaning,
            dialect: activeDialect,
            rate: settings.speechRate,
            onEnd: () => onFinished?.(),
          });
        } else {
          onFinished?.();
        }
      },
      onError: () => {
        setIsSpeakingNow(false);
        onFinished?.();
      },
    });
  };

  // Loop for item-by-item mode
  useEffect(() => {
    if (playerTab !== 'dictation' || !isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
      return;
    }

    if (settings.soundEffects && repeatRound === 1) {
      speechService.playChime('ding');
    }

    speakCurrent(() => {
      if (!isPlayingRef.current) return;

      if (repeatRound < settings.repeatCount) {
        let cd = 2;
        setCountdown(cd);
        timerRef.current = setInterval(() => {
          cd -= 1;
          setCountdown(cd);
          if (cd <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            setCountdown(null);
            if (isPlayingRef.current) {
              setRepeatRound((r) => r + 1);
            }
          }
        }, 1000);
      } else {
        if (!settings.autoAdvance) {
          setIsPlaying(false);
          setRepeatRound(1);
          return;
        }

        let cd = settings.intervalSeconds;
        setCountdown(cd);
        timerRef.current = setInterval(() => {
          cd -= 1;
          setCountdown(cd);
          if (cd <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            setCountdown(null);
            if (isPlayingRef.current) {
              if (currentIndex < set.items.length - 1) {
                setCurrentIndex((idx) => idx + 1);
                setRepeatRound(1);
              } else {
                setIsPlaying(false);
                if (settings.soundEffects) {
                  speechService.playChime('success');
                }
              }
            }
          }
        }, 1000);
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentIndex, repeatRound, playerTab]);

  // Whole Passage sentence-by-sentence paced dictation loop
  const playPassageSentenceAt = (index: number) => {
    if (index >= passageSentences.length) {
      setPassagePlaying(false);
      setPassageSentenceIndex(-1);
      if (settings.soundEffects) speechService.playChime('success');
      return;
    }

    setPassageSentenceIndex(index);
    const sentenceText = passageSentences[index];

    speechService.speak({
      text: sentenceText,
      dialect: activeDialect,
      lang: set.language === 'en' ? 'en' : 'zh',
      rate: settings.speechRate,
      onEnd: () => {
        if (!passagePlayingRef.current) return;

        if (passageMode === 'continuous') {
          // Slight natural pause (0.6s) before next sentence
          setTimeout(() => {
            if (passagePlayingRef.current) {
              playPassageSentenceAt(index + 1);
            }
          }, 600);
        } else {
          // Paced dictation: pause for student writing
          let cd = settings.intervalSeconds;
          setCountdown(cd);
          timerRef.current = setInterval(() => {
            cd -= 1;
            setCountdown(cd);
            if (cd <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              setCountdown(null);
              if (passagePlayingRef.current) {
                playPassageSentenceAt(index + 1);
              }
            }
          }, 1000);
        }
      },
      onError: () => {
        setPassagePlaying(false);
      },
    });
  };

  const handleTogglePassagePlay = () => {
    if (passagePlaying) {
      setPassagePlaying(false);
      speechService.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setCountdown(null);
    } else {
      setPassagePlaying(true);
      const startIdx = passageSentenceIndex >= 0 ? passageSentenceIndex : 0;
      playPassageSentenceAt(startIdx);
    }
  };

  const handleReplayPassageFromStart = () => {
    speechService.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(null);
    setPassagePlaying(true);
    playPassageSentenceAt(0);
  };

  const handleSpeakSinglePassageSentence = (idx: number) => {
    speechService.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(null);
    setPassageSentenceIndex(idx);
    speechService.speak({
      text: passageSentences[idx],
      dialect: activeDialect,
      lang: set.language === 'en' ? 'en' : 'zh',
      rate: settings.speechRate,
    });
  };

  const handleFinishSelfCheck = () => {
    const results = set.items.map((it) => ({
      itemId: it.id,
      targetText: it.text,
      isCorrect: selfChecks[it.id] ?? true,
    }));
    onSelfCheckComplete(results);
  };

  const fullTextContent = set.fullPassage || set.items.map((i) => i.text).join(' ');

  return (
    <div className="space-y-5">
      {/* Top Banner / Mode Switch */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">{set.title}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
              {set.language === 'en' ? '英文 English' : '中文 (清晰女聲)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            全文共 {passageSentences.length} 句（未設限，完整朗讀相片全文） • 語音：
            {activeDialect === 'zh-CN'
              ? '普通話女聲'
              : activeDialect === 'zh-TW'
              ? '國語女聲'
              : activeDialect === 'zh-HK'
              ? '廣東話女聲'
              : 'English 女聲'}
          </p>
        </div>

        {/* Mode Switch: Whole Passage vs Sentence/Word Cards vs Study */}
        <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            onClick={() => {
              setIsPlaying(false);
              setPassagePlaying(false);
              speechService.stop();
              setPlayerTab('passage');
            }}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              playerTab === 'passage'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>全文課文朗讀</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setPassagePlaying(false);
              speechService.stop();
              setPlayerTab('dictation');
            }}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              playerTab === 'dictation'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>逐題/分句默寫</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setPassagePlaying(false);
              speechService.stop();
              setPlayerTab('study');
            }}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              playerTab === 'study'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>認讀預習</span>
          </button>
        </div>
      </div>

      {playerTab === 'passage' ? (
        /* WHOLE PASSAGE DICTATION & READING ROOM */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Visual Passage Player */}
          <div className="lg:col-span-2 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[420px]">
            {/* Top Bar inside Player */}
            <div className="flex flex-wrap items-center justify-between gap-2 z-10">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold text-indigo-200">
                  相片全文 • 全篇共 {passageSentences.length} 句
                </span>
                {passageSentenceIndex >= 0 && (
                  <span className="text-xs text-amber-300 font-bold bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">
                    正在朗讀第 {passageSentenceIndex + 1} 句
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {countdown !== null && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold animate-pulse">
                    書寫倒數 {countdown} 秒
                  </span>
                )}

                {/* Dictation Paced vs Continuous Toggle */}
                <div className="flex rounded-lg bg-white/10 p-0.5 text-[11px] font-semibold">
                  <button
                    onClick={() => setPassageMode('dictation_paced')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      passageMode === 'dictation_paced'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    慢速默書 (停頓)
                  </button>
                  <button
                    onClick={() => setPassageMode('continuous')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      passageMode === 'continuous'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    流暢連續朗讀
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Passage Text Presentation */}
            <div className="my-6 z-10 max-h-[260px] overflow-y-auto pr-2 space-y-3">
              {showPassageText ? (
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-slate-100 text-base sm:text-lg leading-relaxed space-y-2 select-text font-serif">
                  {passageSentences.map((sentence, idx) => {
                    const isCurrent = idx === passageSentenceIndex;
                    const sentencePinyin = showPassagePinyin ? getMandarinPinyin(sentence) : '';
                    return (
                      <span
                        key={idx}
                        onClick={() => handleSpeakSinglePassageSentence(idx)}
                        className={`inline-block cursor-pointer transition-all rounded-lg px-2 py-1 mr-1.5 mb-1.5 ${
                          isCurrent
                            ? 'bg-amber-400 text-slate-900 font-bold shadow-md shadow-amber-400/40'
                            : 'hover:bg-white/15'
                        }`}
                        title="點擊單獨朗讀此句"
                      >
                        {sentencePinyin && (
                          <span className="block text-[11px] font-mono text-amber-200 leading-tight mb-0.5">
                            {sentencePinyin}
                          </span>
                        )}
                        <span>{sentence}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                /* Hidden/Masked during real dictation so student writes on paper */
                <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-center space-y-3">
                  <div className="text-3xl font-black text-indigo-300 tracking-widest">
                    ● ● ● ● ● ● ● ●
                  </div>
                  <p className="text-xs text-slate-300">
                    課文已遮蔽，請專注聆聽清晰女聲朗讀，於實體默書紙上作答。
                  </p>
                </div>
              )}

              {/* Reveal Text Button & Mandarin Pinyin toggle */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassageText(!showPassageText)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  {showPassageText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassageText ? '遮蔽全文（專注默寫）' : '顯示課文對照'}</span>
                </button>

                {showPassageText && set.language !== 'en' && (
                  <button
                    type="button"
                    onClick={() => setShowPassagePinyin(!showPassagePinyin)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      showPassagePinyin
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                        : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{showPassagePinyin ? '✓ 國語拼音已開啟' : '顯示課文國語拼音'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Controls for Whole Passage */}
            <div className="space-y-4 z-10">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleReplayPassageFromStart}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                  title="從頭播放整篇課文"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>從頭重讀全文</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (passageSentenceIndex > 0) {
                        handleSpeakSinglePassageSentence(passageSentenceIndex - 1);
                      }
                    }}
                    disabled={passageSentenceIndex <= 0}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
                    title="上一句"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handleTogglePassagePlay}
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 transition-all"
                  >
                    {passagePlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => {
                      if (passageSentenceIndex < passageSentences.length - 1) {
                        handleSpeakSinglePassageSentence(passageSentenceIndex + 1);
                      }
                    }}
                    disabled={passageSentenceIndex >= passageSentences.length - 1}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
                    title="下一句"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-right text-xs text-indigo-200">
                  語速：{settings.speechRate}x
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Panel: Submit & Grade */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">默書完成？選擇批改方式</h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                學生在紙上寫完整篇課文後，拍照即可進行 AI 逐字逐句批改！
              </p>

              <div className="space-y-3">
                <button
                  onClick={onStartPhotoSubmission}
                  className="w-full p-4 rounded-2xl border-2 border-indigo-200 hover:border-indigo-600 hover:bg-indigo-50/50 text-left transition-all group flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 group-hover:text-indigo-700">
                      <span>拍照自動批改 (推薦)</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.2 rounded-full">
                        AI 筆跡
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      拍下學生在原稿紙上的全文手寫作業，AI 逐句對照標點與錯別字。
                    </p>
                  </div>
                </button>

                <button
                  onClick={onStartDigitalTest}
                  className="w-full p-4 rounded-2xl border-2 border-purple-200 hover:border-purple-600 hover:bg-purple-50/50 text-left transition-all group flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800 group-hover:text-purple-700">
                      線上打字 / 寫字板默寫
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      直接在螢幕輸入句子或手寫板練字，即時獲得正確率評分。
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick tips */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
              <p className="font-bold text-slate-700">💡 溫馨提醒：</p>
              <p>• 點擊上方課文任何一句，女聲老師會立即重讀該句。</p>
              <p>• 若嫌速度太快，可在右上角設定將停頓時間調為 8～12 秒。</p>
            </div>
          </div>
        </div>
      ) : playerTab === 'dictation' ? (
        /* ITEM-BY-ITEM DICTATION MODE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
            {/* Top Bar inside Player */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 z-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs sm:text-sm font-bold text-indigo-200">
                  題號 {currentIndex + 1} / {set.items.length}
                </span>

                {/* Font Size Zoom Controller (Default 2x) */}
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl text-xs backdrop-blur-sm border border-white/10">
                  <span className="text-[11px] text-slate-300 font-semibold px-1.5 flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-amber-300" />
                    <span>字體</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDictationFontScale('normal')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      dictationFontScale === 'normal'
                        ? 'bg-white text-indigo-900 shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    onClick={() => setDictationFontScale('2x')}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      dictationFontScale === '2x'
                        ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold ring-1 ring-amber-300'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="放大兩倍（預設）"
                  >
                    2x (放大兩倍)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDictationFontScale('3x')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      dictationFontScale === '3x'
                        ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold ring-1 ring-amber-300'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    3x 特大
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {countdown !== null && (
                  <span className="text-xs sm:text-sm px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold animate-pulse">
                    倒數 {countdown} 秒進入下一次朗讀
                  </span>
                )}
                <span className="text-xs sm:text-sm px-3 py-1 rounded-full bg-white/10 text-slate-300">
                  朗讀次數：第 {repeatRound} / {settings.repeatCount} 次
                </span>
              </div>
            </div>

            <div className="my-auto py-8 text-center z-10">
              <div className="flex items-center justify-center gap-1.5 mb-5 h-8">
                {isSpeakingNow ? (
                  [40, 70, 100, 60, 90, 50, 80, 40].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-indigo-400 to-pink-400 rounded-full animate-bounce"
                      style={{
                        height: `${h}%`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.6s',
                      }}
                    />
                  ))
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-300 text-xs sm:text-sm">
                    <Volume2 className="w-4 h-4 text-indigo-300" />
                    <span>{isPlaying ? '請在紙上專心書寫...' : '點擊播放開始朗讀'}</span>
                  </div>
                )}
              </div>

              <div className="relative w-full max-w-2xl sm:max-w-3xl md:max-w-4xl mx-auto px-2">
                {showHint ? (
                  <div className="p-5 sm:p-7 bg-slate-900/90 border border-amber-400/35 rounded-3xl backdrop-blur-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left">
                    {/* Header bar of Hint */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/10 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <Sparkles className="w-4 h-4" />
                        <span>題目提示 & 正確答案（第 {currentIndex + 1} 題）</span>
                        {dictationFontScale === '2x' && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono">
                            字體已放大兩倍
                          </span>
                        )}
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                        {currentItem.text.length > 8 ? '分句默寫' : '詞語'}
                      </span>
                    </div>

                    {/* Ruby / Pinyin Character Display for Chinese or Plain Text for English */}
                    {hasChinese && currentPinyinPairs.length > 0 ? (
                      <div className="space-y-4">
                        {/* Ruby style: Character with Pinyin directly above each word - Enlarged 2x */}
                        <div className="p-4 sm:p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-wrap items-end justify-center gap-x-4 sm:gap-x-6 gap-y-4 sm:gap-y-6">
                          {currentPinyinPairs.map((pair, pIdx) => (
                            <div key={pIdx} className="flex flex-col items-center">
                              {/* Pinyin with tone */}
                              <span
                                className={`font-mono text-amber-300 font-bold tracking-wide leading-none ${
                                  dictationFontScale === '3x'
                                    ? 'text-xl sm:text-2xl min-h-[26px]'
                                    : dictationFontScale === '2x'
                                    ? 'text-lg sm:text-xl min-h-[22px]'
                                    : 'text-[12px] sm:text-xs min-h-[14px]'
                                }`}
                              >
                                {pair.pinyin || '\u00A0'}
                              </span>
                              {/* Chinese Character - Double / 2x Font Size */}
                              <span
                                className={`font-black text-white tracking-normal mt-1.5 drop-shadow-sm transition-all ${
                                  dictationFontScale === '3x'
                                    ? 'text-5xl sm:text-6xl md:text-7xl'
                                    : dictationFontScale === '2x'
                                    ? 'text-4xl sm:text-5xl md:text-6xl'
                                    : 'text-xl sm:text-2xl'
                                }`}
                              >
                                {pair.char}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Complete Mandarin Pinyin sentence bar with lady voice button */}
                        {currentMandarinPinyin && (
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                              <span
                                className={`font-bold px-2.5 py-1 rounded-md bg-amber-400 text-slate-900 shrink-0 ${
                                  dictationFontScale === 'normal' ? 'text-[10px]' : 'text-xs sm:text-sm'
                                }`}
                              >
                                國語拼音
                              </span>
                              <span
                                className={`font-mono text-amber-200 font-semibold tracking-wide break-words ${
                                  dictationFontScale === '3x'
                                    ? 'text-lg sm:text-2xl'
                                    : dictationFontScale === '2x'
                                    ? 'text-base sm:text-xl'
                                    : 'text-xs sm:text-sm'
                                }`}
                              >
                                {currentMandarinPinyin}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                speechService.speak({
                                  text: currentItem.text,
                                  dialect: 'zh-CN',
                                  lang: 'zh',
                                  rate: settings.speechRate,
                                });
                              }}
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 hover:text-white text-xs sm:text-sm font-bold transition-all shrink-0 active:scale-95"
                              title="播放普通話/國語女聲朗讀"
                            >
                              <Volume2 className="w-4 h-4 text-amber-300" />
                              <span>國語女聲發音</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* English or non-Chinese - Enlarged 2x */
                      <div className="space-y-3 text-center py-4">
                        <div
                          className={`font-black text-amber-300 tracking-wide ${
                            dictationFontScale === '3x'
                              ? 'text-5xl sm:text-7xl'
                              : dictationFontScale === '2x'
                              ? 'text-4xl sm:text-6xl'
                              : 'text-2xl sm:text-3xl'
                          }`}
                        >
                          {currentItem.text}
                        </div>
                        {currentItem.phonetic && (
                          <div
                            className={`font-mono text-indigo-200 ${
                              dictationFontScale === 'normal' ? 'text-sm' : 'text-base sm:text-xl'
                            }`}
                          >
                            音標/拼音: {currentItem.phonetic}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Additional phonetic (e.g. Cantonese Jyutping) if present */}
                    {currentItem.phonetic && hasChinese && (
                      <div className="text-xs sm:text-sm text-indigo-200 bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div>
                          <span className="text-indigo-300 font-bold mr-2">自訂 / 粵拼：</span>
                          <span className="font-mono text-sm sm:text-base font-semibold">{currentItem.phonetic}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            speechService.speak({
                              text: currentItem.text,
                              dialect: 'zh-HK',
                              lang: 'zh',
                              rate: settings.speechRate,
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-xs text-indigo-200 hover:text-white flex items-center gap-1.5 font-semibold"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>粵語發音</span>
                        </button>
                      </div>
                    )}

                    {/* Meaning / definition */}
                    {currentItem.meaning && (
                      <div className="text-xs sm:text-sm text-slate-300 bg-white/5 px-3.5 py-2.5 rounded-2xl border border-white/5">
                        <span className="text-slate-400 font-bold mr-1.5">釋義 / 提示：</span>
                        <span className="text-sm sm:text-base">{currentItem.meaning}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Masked view - Enlarged 2x dots */
                  <div className="p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
                    <div
                      className={`font-bold text-indigo-300 tracking-widest select-none ${
                        dictationFontScale === '3x'
                          ? 'text-6xl sm:text-7xl'
                          : dictationFontScale === '2x'
                          ? 'text-5xl sm:text-6xl'
                          : 'text-3xl'
                      }`}
                    >
                      {Array.from({ length: Math.min(currentItem.text.length, 12) }).map(() => '●').join(' ')}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium">
                      （字句已遮蔽，請聆聽朗讀於紙上書寫）
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 ${
                    showHint
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                  }`}
                >
                  {showHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-300" />}
                  <span>{showHint ? '隱藏提示' : '偷看提示 / 答案（放大兩倍 • 含國語拼音）'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 z-10">
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-400 via-pink-400 to-amber-300 h-full transition-all duration-300"
                  style={{ width: `${Math.round(((currentIndex + 1) / set.items.length) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    speechService.stop();
                    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                  }}
                  disabled={currentIndex === 0}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      speechService.stop();
                      setRepeatRound(1);
                      speakCurrent();
                    }}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => {
                      if (isPlaying) {
                        setIsPlaying(false);
                        speechService.stop();
                      } else {
                        setIsPlaying(true);
                      }
                    }}
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 transition-all"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => {
                      speechService.stop();
                      if (currentIndex < set.items.length - 1) setCurrentIndex(currentIndex + 1);
                    }}
                    disabled={currentIndex === set.items.length - 1}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-right text-xs text-slate-400">
                  語速: {settings.speechRate}x
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Panel */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">默書完成？選擇批改方式</h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                支援實體紙筆手寫拍照自動評分，或使用線上即時鍵盤作答。
              </p>

              <div className="space-y-3">
                <button
                  onClick={onStartPhotoSubmission}
                  className="w-full p-4 rounded-2xl border-2 border-indigo-200 hover:border-indigo-600 hover:bg-indigo-50/50 text-left transition-all group flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800 group-hover:text-indigo-700">
                      拍照自動批改 (推薦)
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      拍下學生在原稿紙上的手寫成果，AI 逐題對照找出錯處。
                    </p>
                  </div>
                </button>

                <button
                  onClick={onStartDigitalTest}
                  className="w-full p-4 rounded-2xl border-2 border-purple-200 hover:border-purple-600 hover:bg-purple-50/50 text-left transition-all group flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800 group-hover:text-purple-700">
                      線上打字 / 寫字板默寫
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      直接在螢幕輸入文字或手寫板練字，即時獲得正確率評分。
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Self-check Checklist preview */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">家長手動對卷自查</span>
                <button
                  onClick={handleFinishSelfCheck}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  送出結果 →
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {set.items.map((it, idx) => {
                  const isChecked = selfChecks[it.id] ?? true;
                  return (
                    <div
                      key={it.id}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100"
                    >
                      <span className="text-slate-600 truncate mr-2">
                        {idx + 1}. {it.text}
                      </span>
                      <button
                        onClick={() =>
                          setSelfChecks((prev) => ({
                            ...prev,
                            [it.id]: !(prev[it.id] ?? true),
                          }))
                        }
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                          isChecked ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isChecked ? '✓ 正確' : '✗ 錯誤'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STUDY & FLASHCARD MODE */
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">課文與詞語認讀清單</h3>
              <p className="text-xs text-slate-500">點擊播放聽清晰女聲發音，熟悉課文內容與生字詞。</p>
            </div>
            <button
              onClick={() => setPlayerTab('passage')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span>進入全文朗讀默書</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {set.items.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md bg-white transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                    <button
                      onClick={() =>
                        speechService.speak({
                          text: item.text,
                          dialect: activeDialect,
                          rate: settings.speechRate,
                        })
                      }
                      className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                      title="發音朗讀"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="text-xl font-black text-slate-800 tracking-wide mb-1 group-hover:text-indigo-600 transition-colors">
                    {item.text}
                  </h4>

                  {/* Mandarin Pinyin for Chinese items */}
                  {item.text && /[\u4e00-\u9fa5]/.test(item.text) && (
                    <div className="text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg mb-2 flex items-center justify-between gap-1">
                      <span className="truncate">拼音: {getMandarinPinyin(item.text)}</span>
                      <button
                        onClick={() =>
                          speechService.speak({
                            text: item.text,
                            dialect: 'zh-CN',
                            rate: settings.speechRate,
                          })
                        }
                        className="text-amber-900 hover:text-amber-950 bg-amber-200/70 hover:bg-amber-300 font-sans text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 transition-colors"
                        title="國語女聲朗讀"
                      >
                        國語女聲
                      </button>
                    </div>
                  )}

                  {item.phonetic && (
                    <p className="text-xs font-mono text-purple-600 mb-2">{item.phonetic}</p>
                  )}

                  {item.meaning && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mb-2">
                      {item.meaning}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
