import React from 'react';
import { BookOpen, AlertCircle, History, Sparkles, Volume2, Printer, Settings } from 'lucide-react';
import { VoiceDialect } from '../types/dictation';

interface HeaderProps {
  currentTab: 'sets' | 'mistakes' | 'history';
  onSelectTab: (tab: 'sets' | 'mistakes' | 'history') => void;
  mistakeCount: number;
  onOpenSettings: () => void;
  onOpenPrintSheet: () => void;
  activeDialect: VoiceDialect;
  onChangeDialect: (dialect: VoiceDialect) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  mistakeCount,
  onOpenSettings,
  onOpenPrintSheet,
  activeDialect,
  onChangeDialect,
}) => {
  return (
    <header className="bg-white border-b border-indigo-100 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('sets')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-150">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-800">默書小伴侶</h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                AI 智能溫習
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">中英雙語・拍照辨識・語音朗讀・自動批改</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => onSelectTab('sets')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'sets'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>默書庫</span>
          </button>

          <button
            onClick={() => onSelectTab('mistakes')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
              currentTab === 'mistakes'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>錯題本</span>
            {mistakeCount > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.2 text-[11px] font-bold rounded-full ${
                  currentTab === 'mistakes' ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'
                }`}
              >
                {mistakeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">成績</span>紀錄
          </button>
        </div>

        {/* Right Tools: Voice accent, Print grid paper, Settings */}
        <div className="flex items-center gap-2">
          {/* Quick Dialect Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs">
            <Volume2 className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            <select
              value={activeDialect}
              onChange={(e) => onChangeDialect(e.target.value as VoiceDialect)}
              className="bg-transparent text-slate-700 font-semibold py-1 px-1 text-xs focus:outline-none cursor-pointer"
              title="選擇朗讀發音語音"
            >
              <option value="zh-CN">普通話 (標準清晰女聲)</option>
              <option value="zh-TW">國語 (臺灣清晰女聲)</option>
              <option value="zh-HK">廣東話 (香港粵語女聲)</option>
              <option value="en-GB">English (UK 女聲)</option>
              <option value="en-US">English (US 女聲)</option>
            </select>
          </div>

          <button
            onClick={onOpenPrintSheet}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="列印默書紙（田字格/單行紙）"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="默書朗讀設定"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
