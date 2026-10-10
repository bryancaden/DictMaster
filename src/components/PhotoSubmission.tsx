import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Sparkles, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { DictationSet, DictationGradingReport } from '../types/dictation';
import { gradePhoto } from '../services/api';
import { speechService } from '../services/speech';

interface PhotoSubmissionProps {
  set: DictationSet;
  isOpen: boolean;
  onClose: () => void;
  onGradingComplete: (report: DictationGradingReport) => void;
}

export const PhotoSubmission: React.FC<PhotoSubmissionProps> = ({
  set,
  isOpen,
  onClose,
  onGradingComplete,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('請上傳圖片格式');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGrade = async () => {
    if (!imagePreview) {
      setErrorMsg('請先拍攝或上傳手寫默書紙照片');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const gradingResponse = await gradePhoto(imagePreview, set.items, set.language, set.title);

      const report: DictationGradingReport = {
        id: `report_${Date.now()}`,
        setId: set.id,
        setTitle: set.title,
        language: set.language,
        date: Date.now(),
        mode: 'photo',
        totalItems: gradingResponse.totalItems || set.items.length,
        correctCount: gradingResponse.correctCount || 0,
        score: gradingResponse.score ?? 0,
        overallFeedback: gradingResponse.overallFeedback || '完成默書批改！',
        results: gradingResponse.results || [],
        photoDataUrl: imagePreview,
      };

      speechService.playChime('success');
      onGradingComplete(report);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || '批改失敗，請確保字跡清晰且光線充足後重試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">拍照交卷・AI 自動批改</h2>
              <p className="text-xs text-indigo-100">
                對照標準答案（共 {set.items.length} 題），檢查錯別字與拼寫
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!imagePreview ? (
            <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 rounded-2xl p-7 text-center transition-all">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                <Camera className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">拍下學生的手寫默書紙</h4>
              <p className="text-xs text-slate-500 mb-5 max-w-md mx-auto leading-relaxed">
                支援原稿紙、田字格、單行紙或白紙。請盡量垂直拍攝，確保字跡清晰、光線充足無陰影。
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-150 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>立即開啟相機拍照</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>從相簿選取照片</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview with scanner line when loading */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 group">
                <img
                  src={imagePreview}
                  alt="Student Dictation Paper"
                  className="w-full max-h-72 object-contain mx-auto"
                />

                {/* Laser scan animation when grading */}
                {isLoading && (
                  <div className="absolute inset-0 bg-indigo-900/20 backdrop-blur-xs flex flex-col items-center justify-center">
                    <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-pulse top-1/2 -translate-y-1/2" />
                    <div className="p-4 bg-white/95 rounded-2xl shadow-xl flex items-center gap-3 text-slate-800 z-10 border border-indigo-100">
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      <div>
                        <p className="text-xs font-bold">Gemini AI 正在逐題批改筆跡中...</p>
                        <p className="text-[11px] text-slate-500">比對筆劃、部首、錯別字及拼寫</p>
                      </div>
                    </div>
                  </div>
                )}

                {!isLoading && (
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                    title="重拍或更換照片"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Tips for parents */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-700">批改標準答案預覽：</span>
                <p className="text-slate-500 truncate">
                  {set.items.map((it, idx) => `${idx + 1}.${it.text}`).join('、')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setImagePreview(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  重新拍照
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGrade}
                  className="flex-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-150 transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>正在智能批改中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>確認交卷，開始 AI 批改</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
