import React from 'react';
import { Settings, X, Volume2, Clock, RotateCcw, Bell } from 'lucide-react';
import { DictationSettings } from '../types/dictation';
import { speechService } from '../services/speech';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DictationSettings;
  onSaveSettings: (settings: DictationSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  if (!isOpen) return null;

  const handleChange = (partial: Partial<DictationSettings>) => {
    onSaveSettings({
      ...settings,
      ...partial,
    });
  };

  const handleTestSpeech = () => {
    speechService.speak({
      text: '這是一段測試朗讀聲音，一二三，做人要誠實。',
      rate: settings.speechRate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-200" />
            <h2 className="text-base font-bold">默書朗讀偏好設定</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Speech Rate */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-indigo-600" />
                <span>朗讀語速：{settings.speechRate}x</span>
              </label>
              <button
                type="button"
                onClick={handleTestSpeech}
                className="text-indigo-600 font-semibold hover:underline"
              >
                試聽
              </button>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.3"
              step="0.1"
              value={settings.speechRate}
              onChange={(e) => handleChange({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0.6x (超慢)</span>
              <span>0.9x (溫習推薦)</span>
              <span>1.0x (標準)</span>
              <span>1.3x (快)</span>
            </div>
          </div>

          {/* Repeat Count */}
          <div>
            <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
              <RotateCcw className="w-4 h-4 text-indigo-600" />
              <span>每題重複朗讀次數</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleChange({ repeatCount: count })}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    settings.repeatCount === count
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {count} 次
                </button>
              ))}
            </div>
          </div>

          {/* Pause Interval */}
          <div>
            <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>書寫停頓時間（秒）</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[4, 6, 8, 12].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleChange({ intervalSeconds: sec })}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    settings.intervalSeconds === sec
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sec} 秒
                </button>
              ))}
            </div>
          </div>

          {/* Auto Advance Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <p className="font-bold text-slate-800">自動進入下一題</p>
              <p className="text-[11px] text-slate-500">倒數結束後自動朗讀下一題；關閉則需手動點擊</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(e) => handleChange({ autoAdvance: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <p className="font-bold text-slate-800">提示音效 (叮咚/交卷慶祝)</p>
              <p className="text-[11px] text-slate-500">朗讀開始時播放輕柔叮咚聲，提醒學生動筆</p>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEffects}
              onChange={(e) => handleChange({ soundEffects: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            完成儲存
          </button>
        </div>
      </div>
    </div>
  );
};
