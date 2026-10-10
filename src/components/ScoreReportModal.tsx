import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Volume2,
  X,
  AlertCircle,
  Share2,
  BookmarkPlus,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { DictationGradingReport, DictationSet, VoiceDialect } from '../types/dictation';
import { speechService } from '../services/speech';

interface ScoreReportModalProps {
  report: DictationGradingReport | null;
  currentSet: DictationSet;
  activeDialect: VoiceDialect;
  onClose: () => void;
  onRetryAll: () => void;
  onRetryMistakesOnly: (mistakeItems: any[]) => void;
  onSaveMistakesToVault: (report: DictationGradingReport) => void;
}

export const ScoreReportModal: React.FC<ScoreReportModalProps> = ({
  report,
  currentSet,
  activeDialect,
  onClose,
  onRetryAll,
  onRetryMistakesOnly,
  onSaveMistakesToVault,
}) => {
  if (!report) return null;

  // Trigger celebration confetti for score >= 80
  useEffect(() => {
    if (report.score >= 80) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore if not supported
      }
    }
  }, [report.score]);

  const incorrectResults = report.results.filter((r) => !r.isCorrect);
  const correctResults = report.results.filter((r) => r.isCorrect);

  // Grade calculation
  let gradeBadge = { label: '表現出色 卓越', color: 'bg-emerald-500 text-white' };
  if (report.score === 100) {
    gradeBadge = { label: '滿分 100 卓越！', color: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white' };
  } else if (report.score >= 85) {
    gradeBadge = { label: '優秀甲等 A', color: 'bg-emerald-500 text-white' };
  } else if (report.score >= 70) {
    gradeBadge = { label: '良好乙等 B', color: 'bg-indigo-600 text-white' };
  } else if (report.score >= 60) {
    gradeBadge = { label: '及格達標 C', color: 'bg-amber-500 text-white' };
  } else {
    gradeBadge = { label: '需多加溫習 D', color: 'bg-rose-500 text-white' };
  }

  const handleRetestMistakes = () => {
    const mistakeItems = currentSet.items.filter((it) =>
      incorrectResults.some((wrong) => wrong.itemId === it.id || wrong.targetText === it.text)
    );
    if (mistakeItems.length > 0) {
      onRetryMistakesOnly(mistakeItems);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Top Banner with Score */}
        <div className="p-6 bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 text-white text-center relative overflow-hidden shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md mx-auto flex items-center justify-center mb-3 shadow-inner">
            <Trophy className="w-8 h-8 text-amber-300 animate-bounce" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 shadow-xs bg-white/20">
            {gradeBadge.label}
          </div>

          <div className="flex items-baseline justify-center gap-1.5 mb-1">
            <span className="text-5xl font-black tracking-tight">{report.score}</span>
            <span className="text-xl font-bold text-indigo-200">/ 100 分</span>
          </div>

          <p className="text-xs text-indigo-100 font-medium">
            正確率：{Math.round((report.correctCount / report.totalItems) * 100)}%（共 {report.totalItems} 題，答對 {report.correctCount} 題，錯 {incorrectResults.length} 題）
          </p>

          {/* Teacher encouragement remarks */}
          <div className="mt-4 p-3 rounded-2xl bg-white/10 backdrop-blur-md max-w-lg mx-auto text-xs text-indigo-50 border border-white/10">
            {report.overallFeedback}
          </div>
        </div>

        {/* Scrollable Result Breakdown */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Action strip if there are wrong answers */}
          {incorrectResults.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-900">發現 {incorrectResults.length} 個錯字！</p>
                  <p className="text-[11px] text-amber-700">已自動標記，建議即刻針對錯題進行重默以加深記憶。</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetestMistakes}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  即時重默這 {incorrectResults.length} 個錯字
                </button>
              </div>
            </div>
          )}

          {/* Breakdown Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 tracking-wider uppercase">
              逐題批改詳情
            </h4>

            <div className="space-y-2">
              {report.results.map((res, idx) => (
                <div
                  key={res.itemId || idx}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    res.isCorrect
                      ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
                      : 'bg-rose-50/60 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {res.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-bold text-slate-400">第 {idx + 1} 題</span>
                          <span className="font-bold text-slate-800 text-sm">{res.targetText}</span>
                          <button
                            onClick={() =>
                              speechService.speak({
                                text: res.targetText,
                                dialect: activeDialect,
                                rate: 0.9,
                              })
                            }
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="朗讀發音"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {!res.isCorrect && (
                          <div className="mt-1.5 text-xs space-y-0.5">
                            {res.studentText && (
                              <p className="text-slate-600">
                                學生作答：<span className="font-semibold text-rose-700 line-through mr-2">{res.studentText}</span>
                                正確寫法：<span className="font-bold text-emerald-700">{res.targetText}</span>
                              </p>
                            )}
                            {res.errorHighlight && (
                              <p className="text-rose-600 text-[11px] font-medium">
                                錯處說明：{res.errorHighlight}
                              </p>
                            )}
                            {res.feedback && (
                              <p className="text-slate-500 text-[11px]">{res.feedback}</p>
                            )}
                          </div>
                        )}

                        {res.isCorrect && res.feedback && (
                          <p className="text-emerald-700 text-[11px] mt-0.5">{res.feedback}</p>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        res.isCorrect
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {res.isCorrect ? '正確 ✓' : '錯誤 ✗'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => {
              onSaveMistakesToVault(report);
              alert('已將錯字成功存入錯題本！可在頂部「錯題本」隨時重溫。');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>加入錯題本</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onRetryAll();
              }}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>整份重默</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              完成並返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
