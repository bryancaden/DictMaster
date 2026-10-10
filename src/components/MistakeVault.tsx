import React, { useState } from 'react';
import {
  AlertCircle,
  Volume2,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle,
  Play,
  BookOpen,
} from 'lucide-react';
import { MistakeItem, DictationSet, LanguageType, VoiceDialect } from '../types/dictation';
import { speechService } from '../services/speech';

interface MistakeVaultProps {
  mistakes: MistakeItem[];
  activeDialect: VoiceDialect;
  onRemoveMistake: (text: string) => void;
  onClearAll: () => void;
  onStartRetest: (retestSet: DictationSet) => void;
}

export const MistakeVault: React.FC<MistakeVaultProps> = ({
  mistakes,
  activeDialect,
  onRemoveMistake,
  onClearAll,
  onStartRetest,
}) => {
  const [filterLang, setFilterLang] = useState<'all' | 'zh' | 'en'>('all');
  const [selectedWords, setSelectedWords] = useState<string[]>([]);

  const filtered = mistakes.filter((m) => {
    if (filterLang === 'all') return true;
    return m.language === filterLang;
  });

  const handleToggleSelect = (text: string) => {
    if (selectedWords.includes(text)) {
      setSelectedWords(selectedWords.filter((w) => w !== text));
    } else {
      setSelectedWords([...selectedWords, text]);
    }
  };

  const handleSelectAll = () => {
    if (selectedWords.length === filtered.length) {
      setSelectedWords([]);
    } else {
      setSelectedWords(filtered.map((m) => m.text));
    }
  };

  const handleRetest = (itemsToRetest: MistakeItem[]) => {
    if (itemsToRetest.length === 0) return;

    // Detect language of selected
    const hasEn = itemsToRetest.some((m) => m.language === 'en');
    const hasZh = itemsToRetest.some((m) => m.language === 'zh');
    const lang: LanguageType = hasEn && hasZh ? 'mixed' : hasEn ? 'en' : 'zh';

    const retestSet: DictationSet = {
      id: `retest_mistakes_${Date.now()}`,
      title: `錯題加強重默練習（共 ${itemsToRetest.length} 題）`,
      language: lang,
      type: 'words',
      items: itemsToRetest.map((m, idx) => ({
        id: `re_${m.id || idx}`,
        text: m.text,
        phonetic: m.phonetic,
        meaning: m.meaning,
        sentence: m.sentence,
      })),
      createdAt: Date.now(),
    };

    onStartRetest(retestSet);
  };

  const speak = (text: string, lang: LanguageType) => {
    speechService.speak({
      text,
      dialect: activeDialect,
      lang: lang === 'en' ? 'en' : 'zh',
      rate: 0.9,
    });
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-7 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-6 h-6 text-amber-200" />
            <h2 className="text-xl font-bold">智能錯題本・鞏固弱項</h2>
          </div>
          <p className="text-xs text-amber-100 max-w-lg">
            自動記錄在默書中寫錯的生字詞。針對錯題反复聽讀與重默，直到 100% 掌握！
          </p>
        </div>

        {filtered.length > 0 && (
          <button
            onClick={() => handleRetest(filtered)}
            className="px-5 py-2.5 bg-white hover:bg-amber-50 text-amber-700 font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Play className="w-4 h-4 fill-amber-700" />
            <span>一鍵重默全部錯字 ({filtered.length} 個)</span>
          </button>
        )}
      </div>

      {/* Filter and Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(['all', 'zh', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setFilterLang(lang)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterLang === lang
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'all' ? '全部錯題' : lang === 'zh' ? '中文錯字' : '英文錯字'}
            </button>
          ))}
          <span className="text-xs text-slate-400 ml-2">共 {filtered.length} 個詞語</span>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              {selectedWords.length === filtered.length ? '取消全選' : '全選'}
            </button>

            {selectedWords.length > 0 && (
              <button
                onClick={() =>
                  handleRetest(filtered.filter((m) => selectedWords.includes(m.text)))
                }
                className="px-3.5 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-amber-700 transition-colors"
              >
                重默所選 ({selectedWords.length})
              </button>
            )}

            <button
              onClick={() => {
                if (confirm('確定要清空所有錯題本紀錄嗎？')) {
                  onClearAll();
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
              title="清空錯題本"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Grid of Mistake Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">太棒了！目前沒有未掌握的錯字</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            默書時若發現錯誤會自動存入這裡，助你針對性複習、攻克弱項。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isSelected = selectedWords.includes(item.text);
            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between group ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.text)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        錯過 {item.failedCount} 次
                      </span>
                    </div>

                    <button
                      onClick={() => speak(item.text, item.language)}
                      className="p-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-600 hover:text-white transition-colors"
                      title="發音朗讀"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="text-2xl font-black text-slate-800 mb-1">{item.text}</h4>

                  {item.phonetic && (
                    <p className="text-xs font-mono text-purple-600 mb-1">{item.phonetic}</p>
                  )}

                  {item.meaning && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mb-2">
                      {item.meaning}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-400 truncate">
                    來自：{item.fromSetTitle || '默書練習'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleRetest([item])}
                    className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>單獨重默</span>
                  </button>

                  <button
                    onClick={() => onRemoveMistake(item.text)}
                    className="text-slate-400 hover:text-emerald-600 flex items-center gap-1"
                    title="標記已掌握並從錯題本移除"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>已掌握</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
