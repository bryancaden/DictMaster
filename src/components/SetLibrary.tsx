import React, { useState } from 'react';
import {
  Camera,
  Plus,
  Play,
  BookOpen,
  Calendar,
  Trophy,
  Trash2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { DictationSet, LanguageType, VoiceDialect } from '../types/dictation';
import { speechService } from '../services/speech';

interface SetLibraryProps {
  sets: DictationSet[];
  activeSetId: string;
  onSelectSet: (id: string) => void;
  onOpenCreateModal: () => void;
  onDeleteSet: (id: string) => void;
  activeDialect: VoiceDialect;
}

export const SetLibrary: React.FC<SetLibraryProps> = ({
  sets,
  activeSetId,
  onSelectSet,
  onOpenCreateModal,
  onDeleteSet,
  activeDialect,
}) => {
  const [filterLang, setFilterLang] = useState<'all' | 'zh' | 'en'>('all');

  const filteredSets = sets.filter((s) => {
    if (filterLang === 'all') return true;
    return s.language === filterLang;
  });

  const previewAudio = (text: string, lang: LanguageType) => {
    speechService.speak({
      text,
      dialect: activeDialect,
      lang: lang === 'en' ? 'en' : 'zh',
      rate: 0.9,
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero Action Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-xl z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-indigo-100 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>智能溫默書新體驗</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            拍照即錄入，專屬 AI 朗讀與批改
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
            支援中文（粵語/普通話）與英文。只需拍下默書手冊或字詞單，AI 立即辨識生字、發音朗讀，並提供手寫照片自動評分！
          </p>
        </div>

        <div className="z-10 flex flex-wrap gap-3">
          <button
            onClick={onOpenCreateModal}
            className="px-6 py-3.5 bg-white hover:bg-indigo-50 text-indigo-700 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl hover:scale-102 active:scale-98 transition-all"
          >
            <Camera className="w-4 h-4 text-indigo-600" />
            <span>拍照 / 新增默書表</span>
          </button>
        </div>

        {/* Decorative Circles */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5">
          {(['all', 'zh', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setFilterLang(lang)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterLang === lang
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'all' ? '全部清單' : lang === 'zh' ? '中文默書' : '英文默書'}
            </button>
          ))}
          <span className="text-xs text-slate-400 ml-2">共 {filteredSets.length} 個清單</span>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>手動新增 / 貼上文字</span>
        </button>
      </div>

      {/* Sets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSets.map((set) => {
          const isActive = set.id === activeSetId;
          const wordsPreview = set.items.slice(0, 4).map((i) => i.text).join('、');

          return (
            <div
              key={set.id}
              onClick={() => onSelectSet(set.id)}
              className={`rounded-3xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between group relative bg-white ${
                isActive
                  ? 'border-indigo-600 shadow-md ring-4 ring-indigo-50'
                  : 'border-slate-200 hover:border-indigo-300 hover:shadow-xs'
              }`}
            >
              <div>
                {/* Card Top Meta */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        set.language === 'en'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {set.language === 'en' ? '英文 English' : '中文 默寫'}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                      {set.items.length} 題
                    </span>
                  </div>

                  {set.bestScore !== undefined && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Trophy className="w-3 h-3" />
                      <span>最佳 {set.bestScore} 分</span>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
                  {set.title}
                </h3>

                {/* Words snippet preview */}
                <div className="p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
                  <p className="text-[11px] text-slate-400 font-semibold mb-1">默寫詞彙預覽：</p>
                  <p className="text-xs text-slate-600 font-medium line-clamp-2">
                    {wordsPreview}
                    {set.items.length > 4 ? ` 等 ${set.items.length} 題...` : ''}
                  </p>
                </div>
              </div>

              {/* Bottom Card Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  {new Date(set.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`確定要刪除「${set.title}」嗎？`)) {
                        onDeleteSet(set.id);
                      }
                    }}
                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="刪除清單"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSet(set.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isActive ? '正在溫習' : '開始溫默'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
