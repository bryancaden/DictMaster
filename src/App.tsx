import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SetLibrary } from './components/SetLibrary';
import { DictationPlayer } from './components/DictationPlayer';
import { OcrModal } from './components/OcrModal';
import { PhotoSubmission } from './components/PhotoSubmission';
import { DigitalTest } from './components/DigitalTest';
import { ScoreReportModal } from './components/ScoreReportModal';
import { MistakeVault } from './components/MistakeVault';
import { HistoryView } from './components/HistoryView';
import { PrintSheetModal } from './components/PrintSheetModal';
import { SettingsModal } from './components/SettingsModal';
import {
  DictationSet,
  DictationSettings,
  DictationGradingReport,
  MistakeItem,
  VoiceDialect,
} from './types/dictation';
import { storageService, DEFAULT_SETTINGS } from './services/storage';
import { speechService } from './services/speech';
import { Play, ArrowLeft } from 'lucide-react';

export default function App() {
  const [sets, setSets] = useState<DictationSet[]>([]);
  const [activeSetId, setActiveSetId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'sets' | 'mistakes' | 'history'>('sets');
  const [settings, setSettings] = useState<DictationSettings>(DEFAULT_SETTINGS);
  const [activeDialect, setActiveDialect] = useState<VoiceDialect>('zh-HK');
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [history, setHistory] = useState<DictationGradingReport[]>([]);

  // Modal States
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isPhotoGradingOpen, setIsPhotoGradingOpen] = useState(false);
  const [isDigitalTestOpen, setIsDigitalTestOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState<DictationGradingReport | null>(null);

  // View state inside 'sets' tab: 'library' or 'player'
  const [playerActive, setPlayerActive] = useState<boolean>(true);

  // Load initial data
  useEffect(() => {
    const loadedSets = storageService.getSets();
    const storedActiveId = storageService.getActiveSetId();
    const loadedSettings = storageService.getSettings();
    const loadedMistakes = storageService.getMistakes();
    const loadedHistory = storageService.getHistory();

    setSets(loadedSets);
    setActiveSetId(storedActiveId || (loadedSets[0]?.id ?? ''));
    setSettings(loadedSettings);
    setActiveDialect((loadedSettings.preferredVoice as VoiceDialect) || 'zh-HK');
    setMistakes(loadedMistakes);
    setHistory(loadedHistory);
  }, []);

  const activeSet = sets.find((s) => s.id === activeSetId) || sets[0];

  // Auto-switch dialect if set is English or Chinese
  useEffect(() => {
    if (activeSet) {
      if (activeSet.language === 'en' && !activeDialect.startsWith('en')) {
        setActiveDialect('en-GB');
      } else if (activeSet.language === 'zh' && !activeDialect.startsWith('zh')) {
        setActiveDialect('zh-HK');
      }
    }
  }, [activeSetId]);

  const handleSelectSet = (id: string) => {
    setActiveSetId(id);
    storageService.setActiveSetId(id);
    setPlayerActive(true);
  };

  const handleSaveSet = (newSet: DictationSet) => {
    storageService.saveSet(newSet);
    const updated = storageService.getSets();
    setSets(updated);
    setActiveSetId(newSet.id);
    storageService.setActiveSetId(newSet.id);
    setPlayerActive(true);
  };

  const handleDeleteSet = (id: string) => {
    storageService.deleteSet(id);
    const updated = storageService.getSets();
    setSets(updated);
    if (activeSetId === id && updated.length > 0) {
      setActiveSetId(updated[0].id);
      storageService.setActiveSetId(updated[0].id);
    }
  };

  const handleSaveSettings = (newSettings: DictationSettings) => {
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const handleChangeDialect = (dialect: VoiceDialect) => {
    setActiveDialect(dialect);
    const newSettings = { ...settings, preferredVoice: dialect };
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const handleGradingComplete = (report: DictationGradingReport) => {
    setCurrentReport(report);
    storageService.saveHistoryReport(report);
    setHistory(storageService.getHistory());

    // Automatically register mistakes if any
    const failedResults = report.results.filter((r) => !r.isCorrect);
    if (failedResults.length > 0 && activeSet) {
      const itemsToAdd = failedResults.map((f) => {
        const itemObj = activeSet.items.find((it) => it.id === f.itemId || it.text === f.targetText) || {
          id: f.itemId,
          text: f.targetText,
        };
        return {
          item: itemObj,
          setTitle: activeSet.title,
          setId: activeSet.id,
          language: activeSet.language,
        };
      });
      storageService.addMistakes(itemsToAdd);
      setMistakes(storageService.getMistakes());
    }

    // Update sets in state so bestScore is refreshed
    setSets(storageService.getSets());
  };

  const handleSelfCheckComplete = (results: Array<{ itemId: string; targetText: string; isCorrect: boolean }>) => {
    if (!activeSet) return;
    const correctCount = results.filter((r) => r.isCorrect).length;
    const total = results.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    const report: DictationGradingReport = {
      id: `report_${Date.now()}`,
      setId: activeSet.id,
      setTitle: activeSet.title,
      language: activeSet.language,
      date: Date.now(),
      mode: 'self-check',
      totalItems: total,
      correctCount,
      score,
      overallFeedback: score === 100 ? '完美滿分！自查全對！' : score >= 80 ? '自查成績優異！' : '自查完成，及時溫習錯字！',
      results: results.map((r) => ({
        itemId: r.itemId,
        targetText: r.targetText,
        isCorrect: r.isCorrect,
        feedback: r.isCorrect ? '自查正確' : '標記為錯誤，需加強複習',
      })),
    };

    handleGradingComplete(report);
  };

  const handleRemoveMistake = (text: string) => {
    storageService.removeMistake(text);
    setMistakes(storageService.getMistakes());
  };

  const handleClearMistakes = () => {
    storageService.clearMistakes();
    setMistakes([]);
  };

  const handleClearHistory = () => {
    localStorage.removeItem('dictation_pal_history');
    setHistory([]);
  };

  // Start targeted retest of mistake items
  const handleStartRetest = (retestSet: DictationSet) => {
    storageService.saveSet(retestSet);
    const updated = storageService.getSets();
    setSets(updated);
    setActiveSetId(retestSet.id);
    setCurrentTab('sets');
    setPlayerActive(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans">
      {/* App Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'sets') setPlayerActive(false);
        }}
        mistakeCount={mistakes.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPrintSheet={() => setIsPrintOpen(true)}
        activeDialect={activeDialect}
        onChangeDialect={handleChangeDialect}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentTab === 'sets' && (
          <div>
            {playerActive && activeSet ? (
              <div className="space-y-4">
                {/* Back to Library button */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPlayerActive(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>返回默書庫清單</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsPrintOpen(true)}
                      className="text-xs text-indigo-600 hover:underline font-semibold"
                    >
                      列印此篇默書紙
                    </button>
                  </div>
                </div>

                {/* Dictation Core Player */}
                <DictationPlayer
                  set={activeSet}
                  settings={settings}
                  activeDialect={activeDialect}
                  onStartPhotoSubmission={() => setIsPhotoGradingOpen(true)}
                  onStartDigitalTest={() => setIsDigitalTestOpen(true)}
                  onSelfCheckComplete={handleSelfCheckComplete}
                />
              </div>
            ) : (
              /* Sets Library Overview */
              <SetLibrary
                sets={sets}
                activeSetId={activeSetId}
                onSelectSet={handleSelectSet}
                onOpenCreateModal={() => setIsOcrModalOpen(true)}
                onDeleteSet={handleDeleteSet}
                activeDialect={activeDialect}
              />
            )}
          </div>
        )}

        {currentTab === 'mistakes' && (
          <MistakeVault
            mistakes={mistakes}
            activeDialect={activeDialect}
            onRemoveMistake={handleRemoveMistake}
            onClearAll={handleClearMistakes}
            onStartRetest={handleStartRetest}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            history={history}
            onSelectReport={(rep) => setCurrentReport(rep)}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <p>默書小伴侶 • AI 智能中英溫默書與自動批改 • 讓孩子愛上默書，家長更輕鬆</p>
      </footer>

      {/* Modals */}
      <OcrModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onSaveSet={handleSaveSet}
      />

      {activeSet && (
        <>
          <PhotoSubmission
            set={activeSet}
            isOpen={isPhotoGradingOpen}
            onClose={() => setIsPhotoGradingOpen(false)}
            onGradingComplete={handleGradingComplete}
          />

          <DigitalTest
            set={activeSet}
            activeDialect={activeDialect}
            speechRate={settings.speechRate}
            isOpen={isDigitalTestOpen}
            onClose={() => setIsDigitalTestOpen(false)}
            onGradingComplete={handleGradingComplete}
          />

          <PrintSheetModal
            isOpen={isPrintOpen}
            onClose={() => setIsPrintOpen(false)}
            activeSet={activeSet}
          />
        </>
      )}

      {currentReport && activeSet && (
        <ScoreReportModal
          report={currentReport}
          currentSet={activeSet}
          activeDialect={activeDialect}
          onClose={() => setCurrentReport(null)}
          onRetryAll={() => {
            setCurrentReport(null);
            setPlayerActive(true);
          }}
          onRetryMistakesOnly={(mistakeItems) => {
            const retestSet: DictationSet = {
              id: `retest_fail_${Date.now()}`,
              title: `針對錯字重默：${activeSet.title}`,
              language: activeSet.language,
              type: 'words',
              items: mistakeItems,
              createdAt: Date.now(),
            };
            handleStartRetest(retestSet);
          }}
          onSaveMistakesToVault={() => {
            // mistakes already recorded on grading complete
          }}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
