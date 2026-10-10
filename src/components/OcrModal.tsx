import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Volume2,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  RotateCw,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { DictationItem, DictationSet, LanguageType } from '../types/dictation';
import { performOcr } from '../services/api';
import { speechService } from '../services/speech';
import { splitPassageIntoSentences, splitTextIntoWords } from '../utils/textSplitter';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSet: (newSet: DictationSet) => void;
}

export const OcrModal: React.FC<OcrModalProps> = ({ isOpen, onClose, onSaveSet }) => {
  const [tab, setTab] = useState<'upload' | 'manual'>('upload');
  const [language, setLanguage] = useState<'auto' | 'zh' | 'en'>('auto');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [manualText, setManualText] = useState<string>('');
  const [manualTitle, setManualTitle] = useState<string>('我的默書清單');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Raw text extracted from picture
  const [rawConvertedText, setRawConvertedText] = useState<string>('');
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Review step state after recognition
  const [reviewSet, setReviewSet] = useState<DictationSet | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Support clipboard paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              setImagePreview(reader.result as string);
              setTab('upload');
              setErrorMsg(null);
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('請上傳圖片格式（JPG、PNG 或 WEBP）');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // Rotate image by 90 degrees
  const handleRotateImage = () => {
    if (!imagePreview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      setImagePreview(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = imagePreview;
  };

  // Convert raw multiline text into items
  const parseRawTextToItems = (text: string, title?: string): DictationSet => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const isEn = /^[A-Za-z0-9\s.,!?'"()-]+$/.test(text);
    const setLang: LanguageType = language !== 'auto' ? language : isEn ? 'en' : 'zh';

    const items: DictationItem[] = lines.map((line, idx) => {
      // Remove leading numbering: "1. ", "1、", "(1) "
      let cleanText = line.replace(/^[\d+.\-•*#\(\)一二三四五六七八九十、\s]+/, '').trim();
      let meaning = '';
      let phonetic = '';

      if (cleanText.includes(' - ')) {
        const parts = cleanText.split(' - ');
        cleanText = parts[0].trim();
        meaning = parts.slice(1).join(' - ').trim();
      } else if (cleanText.includes('\t')) {
        const parts = cleanText.split('\t');
        cleanText = parts[0].trim();
        meaning = parts[1]?.trim() || '';
      } else if (cleanText.includes('(') && cleanText.endsWith(')')) {
        const match = cleanText.match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
          cleanText = match[1].trim();
          meaning = match[2].trim();
        }
      }

      return {
        id: `ocr_${Date.now()}_${idx}`,
        text: cleanText || line,
        phonetic,
        meaning,
        sentence: '',
      };
    });

    return {
      id: `set_${Date.now()}`,
      title: title || reviewSet?.title || manualTitle || '辨識出的默書清單',
      language: setLang,
      type: 'words',
      items,
      createdAt: Date.now(),
    };
  };

  const handleRecognize = async () => {
    if (!imagePreview) {
      setErrorMsg('請先拍攝或上傳相片');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await performOcr(imagePreview, language, customNotes);

      // Extract raw text and full passage
      const fullText = data.fullPassage || data.rawText || (data.items || []).map((it) => it.text).join('\n');
      setRawConvertedText(fullText);

      // Check if text is a passage with sentences
      const hasSentencePunctuation = /[。！？.!?]/.test(fullText);
      let items: DictationItem[] = [];

      if (hasSentencePunctuation) {
        // Enforce "一句為一題自動分拆，根據上傳照片全文拆"
        const sentences = splitPassageIntoSentences(fullText);
        if (sentences.length > 0) {
          items = sentences.map((sentence, idx) => ({
            id: `sent_${Date.now()}_${idx}`,
            text: sentence,
            phonetic: '',
            meaning: '',
            sentence: '',
          }));
        }
      }

      // If no sentence punctuation or items still empty, fallback to words
      if (items.length === 0) {
        items = (data.items || []).map((it, idx) => ({
          id: it.id || `item_${Date.now()}_${idx}`,
          text: (it.text || '').trim(),
          phonetic: it.phonetic || '',
          meaning: it.meaning || '',
          sentence: it.sentence || '',
        })).filter((it) => it.text.length > 0);
      }

      if (items.length === 0 && fullText.trim().length > 0) {
        const parsedSet = parseRawTextToItems(fullText, data.title);
        items = parsedSet.items;
      }

      if (items.length === 0 && (!fullText || fullText.trim().length === 0)) {
        throw new Error('未能從相片讀取到文字，請確認照片字跡清楚且光線充足後再試一次');
      }

      const generatedSet: DictationSet = {
        id: `set_${Date.now()}`,
        title: data.title || (hasSentencePunctuation ? '課文全文句子默寫' : '相片辨識默書清單'),
        language: data.language || (language === 'en' ? 'en' : 'zh'),
        type: hasSentencePunctuation ? 'sentences' : (data.type || 'words'),
        fullPassage: fullText,
        notes: data.notes || '',
        items,
        createdAt: Date.now(),
      };

      setReviewSet(generatedSet);
      speechService.playChime('success');
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMsg(err?.message || '辨識相片失敗，請重試或改用較清晰的照片');
    } finally {
      setIsLoading(false);
    }
  };

  // Split raw text into sentences (一句為一題)
  const handleSplitBySentence = () => {
    if (!rawConvertedText.trim()) return;
    const sentences = splitPassageIntoSentences(rawConvertedText);
    if (sentences.length === 0) return;

    const items: DictationItem[] = sentences.map((st, idx) => ({
      id: `sent_${Date.now()}_${idx}`,
      text: st,
      phonetic: '',
      meaning: '',
      sentence: '',
    }));

    if (reviewSet) {
      setReviewSet({
        ...reviewSet,
        type: 'sentences',
        fullPassage: rawConvertedText,
        items,
      });
    }
  };

  // Split raw text line by line (一行為一題)
  const handleSplitByLine = () => {
    if (!rawConvertedText.trim()) return;
    const lines = rawConvertedText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const items: DictationItem[] = lines.map((line, idx) => ({
      id: `line_${Date.now()}_${idx}`,
      text: line,
      phonetic: '',
      meaning: '',
      sentence: '',
    }));

    if (reviewSet) {
      setReviewSet({
        ...reviewSet,
        items,
      });
    }
  };

  // Split raw text into words by punctuation (詞語模式)
  const handleSplitByWords = () => {
    if (!rawConvertedText.trim()) return;
    const words = splitTextIntoWords(rawConvertedText);
    const items: DictationItem[] = words.map((w, idx) => ({
      id: `word_${Date.now()}_${idx}`,
      text: w,
      phonetic: '',
      meaning: '',
      sentence: '',
    }));

    if (reviewSet) {
      setReviewSet({
        ...reviewSet,
        type: 'words',
        items,
      });
    }
  };

  const handleManualConvert = () => {
    if (!manualText.trim()) {
      setErrorMsg('請輸入要默寫的字詞或句子');
      return;
    }
    const set = parseRawTextToItems(manualText, manualTitle);
    setReviewSet(set);
    setRawConvertedText(manualText);
  };

  const handleSaveConfirmed = () => {
    if (!reviewSet) return;
    const validItems = reviewSet.items.filter((it) => it.text.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMsg('默書清單不能為空');
      return;
    }

    onSaveSet({
      ...reviewSet,
      items: validItems,
    });
    onClose();
  };

  const handleCopyRawText = () => {
    if (!rawConvertedText) return;
    navigator.clipboard.writeText(rawConvertedText);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleReapplyRawText = () => {
    const updated = parseRawTextToItems(rawConvertedText, reviewSet?.title);
    setReviewSet(updated);
  };

  const speakItem = (text: string) => {
    speechService.speak({
      text,
      lang: reviewSet?.language === 'en' ? 'en' : 'zh',
      rate: 0.9,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-3xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {reviewSet ? '相片文字辨識結果 (OCR 轉換)' : '拍照 / 上傳相片讀取文字'}
              </h2>
              <p className="text-xs text-indigo-100">
                {reviewSet
                  ? '已成功從相片讀取文字並轉為默書清單，可隨時編輯或複製'
                  : 'AI 自動辨識中英文課本、手寫紙或詞語表'}
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <span className="font-bold">提示：</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {!reviewSet ? (
            /* Upload / Capture Stage */
            <div className="space-y-4">
              {/* Tab Switch */}
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  onClick={() => setTab('upload')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    tab === 'upload' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>拍照 / 上傳圖片 (OCR 轉文字)</span>
                </button>
                <button
                  onClick={() => setTab('manual')}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    tab === 'manual' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>文字直接輸入 / 貼上</span>
                </button>
              </div>

              {/* Language Selection */}
              <div className="flex items-center justify-between text-xs bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100">
                <span className="text-indigo-900 font-medium">默書目標語言：</span>
                <div className="flex gap-1.5">
                  {[
                    { id: 'auto', label: '自動辨識' },
                    { id: 'zh', label: '中文 (繁/簡/粵/普)' },
                    { id: 'en', label: '英文 (English)' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLanguage(l.id as any)}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        language === l.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'upload' ? (
                <div className="space-y-4">
                  {/* Upload Drop Zone */}
                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 rounded-3xl p-8 text-center transition-all">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                        <Camera className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1">
                        拍下或選取要默寫的相片
                      </h4>
                      <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto leading-relaxed">
                        支援默書表、課本詞語、工作紙或手寫筆記。電腦端支援直接截圖按 <b>Ctrl+V</b> 貼上！
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-150 transition-all"
                        >
                          <Camera className="w-4 h-4" />
                          <span>即時拍照</span>
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
                          <span>從相簿上傳</span>
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
                    /* Image Preview with Rotate Controls */
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 group max-h-64 flex items-center justify-center">
                        <img
                          src={imagePreview}
                          alt="Dictation Upload"
                          className="max-h-64 object-contain mx-auto"
                        />
                        <div className="absolute top-3 right-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRotateImage}
                            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors flex items-center gap-1 text-xs px-2.5"
                            title="向右旋轉 90 度"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>旋轉</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImagePreview(null)}
                            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                            title="更換相片"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>相片載入就緒，點擊下方開始辨識</span>
                        <button
                          type="button"
                          onClick={handleRotateImage}
                          className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>若方向不正，按此旋轉 90°</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional Custom Instructions */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      額外要求（選填）
                    </label>
                    <input
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="例：只提取第 1 至 10 個生詞，略過標題"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    disabled={!imagePreview || isLoading}
                    onClick={handleRecognize}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-150 transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>正在讀取相片並轉換為文字...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>讀取相片並轉換為文字 (OCR)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Manual Text Input */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">默書標題</label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="例如：第四課 常用詞語"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-slate-700">默寫文字內容（每行一個字詞或句子）</label>
                      <span className="text-[11px] text-slate-400">支援「詞語 - 意思」</span>
                    </div>
                    <textarea
                      rows={8}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder={`誠實 - 不說謊\n謙虛 - 虛心不自滿\n勇敢\n堅持\n團結`}
                      className="w-full text-xs p-3 font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualConvert}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    下一步：檢視與確認清單
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Result Review Stage: Shows Raw Converted Text & Parsed Dictation Items */
            <div className="space-y-5">
              {/* Title input */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <input
                  type="text"
                  value={reviewSet.title}
                  onChange={(e) => setReviewSet({ ...reviewSet, title: e.target.value })}
                  className="font-bold text-slate-800 text-sm px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl flex-1 mr-3"
                />
                <span className="text-xs text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full shrink-0">
                  共 {reviewSet.items.length} 題
                </span>
              </div>

              {/* 1. Raw Converted Text Panel */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      從相片讀取出的全文內容 (可在此編輯或直接修改)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyRawText}
                      className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white transition-colors"
                      title="複製文字"
                    >
                      {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRaw ? '已複製' : '複製文字'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReapplyRawText}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                      title="依據上面文字重新解析題目"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>更新題目列表</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={rawConvertedText}
                  onChange={(e) => setRawConvertedText(e.target.value)}
                  placeholder="圖片轉換的純文字將顯示在此..."
                  className="w-full text-xs p-3 font-mono border border-slate-200 bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />

                {/* Splitting controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">自動拆題方式：</span>
                    <button
                      type="button"
                      onClick={handleSplitBySentence}
                      className={`px-3 py-1 rounded-xl font-bold text-xs transition-all ${
                        reviewSet.type === 'sentences'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                      }`}
                      title="依照全文句號、問號、驚嘆號自動拆分，每句獨立為一題"
                    >
                      ✨ 一句為一題 (按全文標點分拆)
                    </button>
                    <button
                      type="button"
                      onClick={handleSplitByLine}
                      className="px-2.5 py-1 rounded-xl font-medium text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
                      title="依照換行每行拆為一題"
                    >
                      一行為一題
                    </button>
                    <button
                      type="button"
                      onClick={handleSplitByWords}
                      className="px-2.5 py-1 rounded-xl font-medium text-xs bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
                      title="依照頓號或逗號拆分詞語"
                    >
                      詞語模式
                    </button>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-bold bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                    已自動拆出 {reviewSet.items.length} 題
                  </span>
                </div>
              </div>

              {/* 2. Structured Items Cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    默書題目清單 (共 {reviewSet.items.length} 題)
                  </span>
                  <span className="text-[11px] text-slate-400">可試聽發音或手動增刪</span>
                </div>

                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {reviewSet.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-all flex items-start gap-2.5 text-xs shadow-2xs"
                    >
                      <span className="font-bold text-slate-400 pt-1.5 w-6 text-center shrink-0">
                        {idx + 1}
                      </span>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.text}
                            onChange={(e) => {
                              const newItems = [...reviewSet.items];
                              newItems[idx].text = e.target.value;
                              setReviewSet({ ...reviewSet, items: newItems });
                            }}
                            placeholder="要默寫的字詞 / 句子"
                            className="font-bold text-slate-800 text-sm flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => speakItem(item.text)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="試聽發音朗讀"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            value={item.phonetic || ''}
                            onChange={(e) => {
                              const newItems = [...reviewSet.items];
                              newItems[idx].phonetic = e.target.value;
                              setReviewSet({ ...reviewSet, items: newItems });
                            }}
                            placeholder="拼音 / 音標 (選填)"
                            className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none"
                          />
                          <input
                            type="text"
                            value={item.meaning || ''}
                            onChange={(e) => {
                              const newItems = [...reviewSet.items];
                              newItems[idx].meaning = e.target.value;
                              setReviewSet({ ...reviewSet, items: newItems });
                            }}
                            placeholder="中文釋義 / 提示 (選填)"
                            className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const newItems = reviewSet.items.filter((_, i) => i !== idx);
                          setReviewSet({ ...reviewSet, items: newItems });
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                        title="刪除此題"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReviewSet({
                      ...reviewSet,
                      items: [
                        ...reviewSet.items,
                        {
                          id: `item_${Date.now()}_add`,
                          text: '',
                          phonetic: '',
                          meaning: '',
                        },
                      ],
                    });
                  }}
                  className="w-full py-2.5 border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50/50 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>新增題目</span>
                </button>
              </div>

              {/* Bottom Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewSet(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-semibold transition-colors"
                >
                  重新拍照 / 換照片
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfirmed}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-150 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>儲存並開始溫默書</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
