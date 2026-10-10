import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  X,
  SkipForward,
  SkipBack,
  RotateCcw,
  Eraser,
  Sparkles,
  Loader2,
  CheckCircle2,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DictationSet, DictationGradingReport, VoiceDialect } from '../types/dictation';
import { gradeTextSubmissions } from '../services/api';
import { speechService } from '../services/speech';
import { getMandarinPinyin } from '../utils/pinyinUtil';

interface DigitalTestProps {
  set: DictationSet;
  activeDialect: VoiceDialect;
  speechRate: number;
  isOpen: boolean;
  onClose: () => void;
  onGradingComplete: (report: DictationGradingReport) => void;
}

export const DigitalTest: React.FC<DigitalTestProps> = ({
  set,
  activeDialect,
  speechRate,
  isOpen,
  onClose,
  onGradingComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Drawing canvas ref for stylus / mouse Chinese writing practice
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  if (!isOpen) return null;

  const currentItem = set.items[currentIndex];

  const handleSpeakWord = () => {
    if (!currentItem) return;
    speechService.speak({
      text: `${set.language === 'en' ? 'Number ' : '第 '}${currentIndex + 1}${set.language === 'en' ? '. ' : ' 題。'}${currentItem.text}`,
      dialect: activeDialect,
      lang: set.language === 'en' ? 'en' : 'zh',
      rate: speechRate,
    });
  };

  // Clear scratchpad canvas
  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#312e81';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const submissions = set.items.map((it) => ({
        itemId: it.id,
        targetText: it.text,
        studentInput: (answers[it.id] || '').trim(),
      }));

      const gradeRes = await gradeTextSubmissions(submissions, set.language);

      const report: DictationGradingReport = {
        id: `report_${Date.now()}`,
        setId: set.id,
        setTitle: set.title,
        language: set.language,
        date: Date.now(),
        mode: 'digital',
        totalItems: set.items.length,
        correctCount: gradeRes.correctCount,
        score: gradeRes.score,
        overallFeedback: gradeRes.overallFeedback,
        results: gradeRes.results,
      };

      speechService.playChime('success');
      onGradingComplete(report);
      onClose();
    } catch (err: any) {
      alert('評分時發生錯誤：' + (err?.message || '請重試'));
    } finally {
      setIsLoading(false);
    }
  };

  const answeredCount = Object.values(answers).filter((v) => v.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold">線上默寫練習</h2>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                已答 {answeredCount} / {set.items.length} 題
              </span>
            </div>
            <p className="text-xs text-purple-100 truncate max-w-sm">{set.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Selector Tabs */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto flex gap-1.5 shrink-0">
          {set.items.map((it, idx) => {
            const hasAns = (answers[it.id] || '').trim().length > 0;
            const isCur = idx === currentIndex;
            return (
              <button
                key={it.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowHint(false);
                  handleClearCanvas();
                }}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  isCur
                    ? 'bg-indigo-600 text-white shadow-xs scale-105'
                    : hasAns
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Question Speaker */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-700">第 {currentIndex + 1} 題</span>
              <p className="text-xs text-slate-500 mt-0.5">點擊發音按鈕聆聽題目朗讀</p>
            </div>
            <button
              onClick={handleSpeakWord}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span>朗讀此題</span>
            </button>
          </div>

          {/* Peek hint button & Mandarin Pinyin panel */}
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
              >
                {showHint ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showHint ? '隱藏提示' : '偷看提示 / 答案（含國語拼音）'}</span>
              </button>
            </div>

            {showHint && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-slate-800 space-y-3 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200/60">
                  <span className="font-bold text-amber-900 text-xs">參考答案（字體已放大）：</span>
                  <span className="font-black text-slate-900 text-2xl sm:text-3xl tracking-wide">{currentItem.text}</span>
                </div>
                {/[\u4e00-\u9fa5]/.test(currentItem.text) && (
                  <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white/90 p-3 rounded-xl border border-amber-200/80">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                        國語拼音
                      </span>
                      <span className="font-mono text-amber-900 font-bold text-base sm:text-lg">
                        {getMandarinPinyin(currentItem.text)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        speechService.speak({
                          text: currentItem.text,
                          dialect: 'zh-CN',
                          lang: 'zh',
                          rate: speechRate,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="聽國語女聲"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>國語女聲</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Answer Input Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              請輸入你的答案：
            </label>
            {currentItem.text.length > 20 ? (
              <textarea
                rows={3}
                autoFocus
                value={answers[currentItem.id] || ''}
                onChange={(e) =>
                  setAnswers({
                    ...answers,
                    [currentItem.id]: e.target.value,
                  })
                }
                placeholder={
                  set.language === 'en' ? 'Type the sentence here...' : '在此輸入完整句子...'
                }
                className="w-full text-base font-bold px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none transition-all shadow-xs leading-relaxed"
              />
            ) : (
              <input
                type="text"
                autoFocus
                value={answers[currentItem.id] || ''}
                onChange={(e) =>
                  setAnswers({
                    ...answers,
                    [currentItem.id]: e.target.value,
                  })
                }
                placeholder={
                  set.language === 'en' ? 'Type the English word here...' : '在此輸入中文詞語或句子...'
                }
                className="w-full text-lg font-bold px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none transition-all shadow-xs"
              />
            )}
          </div>

          {/* Digital Handwriting Scratchpad Toggle (Useful for Chinese strokes on tablet/touchscreen) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>手寫練字板 / 塗鴉筆劃草稿（選用）</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="text-slate-500 hover:text-rose-600 flex items-center gap-1"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>清除筆跡</span>
                </button>
              </div>
            </div>
            <div className="p-3 bg-white">
              <canvas
                ref={canvasRef}
                width={500}
                height={130}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-32 bg-amber-50/20 border border-dashed border-amber-200 rounded-xl cursor-crosshair touch-none"
              />
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                handleClearCanvas();
              }
            }}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
            <span>上一題</span>
          </button>

          {currentIndex < set.items.length - 1 ? (
            <button
              onClick={() => {
                setCurrentIndex(currentIndex + 1);
                handleClearCanvas();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <span>下一題</span>
              <SkipForward className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-150 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在評分中...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>交卷並查看成績</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
