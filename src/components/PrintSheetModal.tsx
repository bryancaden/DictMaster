import React, { useState } from 'react';
import { Printer, X, FileText, Check } from 'lucide-react';
import { DictationSet } from '../types/dictation';

interface PrintSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSet?: DictationSet;
}

export const PrintSheetModal: React.FC<PrintSheetModalProps> = ({
  isOpen,
  onClose,
  activeSet,
}) => {
  const [paperStyle, setPaperStyle] = useState<'tian' | 'single' | 'fourline'>('tian');
  const [includeAnswerKey, setIncludeAnswerKey] = useState<boolean>(false);
  const [questionCount, setQuestionCount] = useState<number>(activeSet?.items.length || 10);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-3xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header (hidden in print) */}
        <div className="print:hidden px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-200" />
            <div>
              <h2 className="text-base font-bold">列印手寫默書紙</h2>
              <p className="text-xs text-indigo-100">支援中文田字格、英文四線三格、單行紙</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Print Configuration Controls (hidden in print) */}
        <div className="print:hidden p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">紙張樣式：</span>
            <div className="flex rounded-xl bg-slate-200 p-0.5">
              <button
                onClick={() => setPaperStyle('tian')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  paperStyle === 'tian' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                田字格 (中文)
              </button>
              <button
                onClick={() => setPaperStyle('fourline')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  paperStyle === 'fourline' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                四線三格 (英文)
              </button>
              <button
                onClick={() => setPaperStyle('single')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  paperStyle === 'single' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                標準單行紙
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>立即列印 (Print)</span>
            </button>
          </div>
        </div>

        {/* Printable Paper Area (Styled for A4 print) */}
        <div className="p-8 overflow-y-auto flex-1 bg-white print:p-0 print:m-0" id="printable-sheet">
          {/* Paper Header */}
          <div className="border-b-2 border-slate-800 pb-3 mb-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-wider">
                  {activeSet ? activeSet.title : '學生默書練習紙'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">默書小伴侶 • 智能溫習</p>
              </div>
              <div className="text-right text-xs text-slate-700 space-y-1">
                <span className="inline-block mr-4">班別：__________</span>
                <span className="inline-block mr-4">姓名：__________</span>
                <span className="inline-block mr-4">日期：__________</span>
                <span className="inline-block font-bold">成績：______ / 100</span>
              </div>
            </div>
          </div>

          {/* Grid Rows */}
          <div className="space-y-5">
            {Array.from({ length: Math.max(activeSet?.items.length || 10, 8) }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-6 font-bold text-sm text-slate-600 text-right shrink-0">
                  {idx + 1}.
                </div>

                {paperStyle === 'tian' && (
                  /* Chinese Tian Zi Ge row */
                  <div className="flex gap-1.5 flex-1">
                    {Array.from({ length: 6 }).map((_, cIdx) => (
                      <div
                        key={cIdx}
                        className="w-12 h-12 border-2 border-slate-400 relative flex items-center justify-center bg-white"
                      >
                        {/* Cross dashed lines inside Tian Zi Ge */}
                        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-300" />
                        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-slate-300" />
                      </div>
                    ))}
                    <div className="flex-1 border-b border-dashed border-slate-300 ml-2" />
                  </div>
                )}

                {paperStyle === 'fourline' && (
                  /* English 4-lines grid */
                  <div className="flex-1 h-12 border border-slate-300 relative bg-white">
                    <div className="absolute inset-x-0 top-1/3 border-t border-slate-200" />
                    <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-pink-300" />
                    <div className="absolute inset-x-0 bottom-0 border-b border-slate-300" />
                  </div>
                )}

                {paperStyle === 'single' && (
                  /* Standard ruled line */
                  <div className="flex-1 h-10 border-b-2 border-slate-300" />
                )}
              </div>
            ))}
          </div>

          {/* Footer Notes */}
          <div className="mt-12 pt-4 border-t border-slate-300 text-center text-xs text-slate-400">
            請保持字體工整，完成後使用「默書小伴侶」手機拍照進行 AI 自動評分。
          </div>
        </div>
      </div>
    </div>
  );
};
