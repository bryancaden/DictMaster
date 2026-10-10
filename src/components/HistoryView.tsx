import React from 'react';
import { History, Trophy, Calendar, CheckCircle, XCircle, ArrowRight, Trash2 } from 'lucide-react';
import { DictationGradingReport } from '../types/dictation';

interface HistoryViewProps {
  history: DictationGradingReport[];
  onSelectReport: (report: DictationGradingReport) => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onSelectReport,
  onClearHistory,
}) => {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-3">
          <History className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-slate-800 text-base mb-1">暫無默書紀錄</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          完成一次默書練習並批改後，成績與正確率將自動記錄於此。
        </p>
      </div>
    );
  }

  // Calculate statistics
  const totalTests = history.length;
  const avgScore = Math.round(history.reduce((acc, h) => acc + h.score, 0) / totalTests);
  const bestScore = Math.max(...history.map((h) => h.score));

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">總溫習次數</p>
            <h4 className="text-2xl font-black text-slate-800">{totalTests} 次</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">歷史最高分</p>
            <h4 className="text-2xl font-black text-amber-600">{bestScore} 分</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">平均正確率</p>
            <h4 className="text-2xl font-black text-emerald-600">{avgScore}%</h4>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base">默書成績簿</h3>
          <button
            onClick={() => {
              if (confirm('確定要清空所有歷史紀錄嗎？')) {
                onClearHistory();
              }
            }}
            className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空紀錄</span>
          </button>
        </div>

        <div className="space-y-3">
          {history.map((record) => (
            <div
              key={record.id}
              onClick={() => onSelectReport(record)}
              className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-xs bg-slate-50/50 hover:bg-white transition-all cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black ${
                    record.score >= 80
                      ? 'bg-emerald-100 text-emerald-700'
                      : record.score >= 60
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <span className="text-base">{record.score}</span>
                  <span className="text-[9px] font-semibold">分</span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-800">{record.setTitle}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(record.date).toLocaleDateString()} {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>•</span>
                    <span>
                      方式：{record.mode === 'photo' ? '拍照批改' : record.mode === 'digital' ? '線上默寫' : '手動自查'}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold">
                      答對 {record.correctCount}/{record.totalItems} 題
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-600 font-semibold group-hover:underline">
                  查看詳情
                </span>
                <ArrowRight className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
