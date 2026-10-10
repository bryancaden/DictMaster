import { DictationItem, DictationGradingReport, LanguageType } from '../types/dictation';

export interface OcrResponse {
  rawText?: string;
  fullPassage?: string;
  title: string;
  language: LanguageType;
  type?: 'words' | 'sentences' | 'paragraphs';
  notes?: string;
  items: Array<{
    id: string;
    text: string;
    phonetic?: string;
    meaning?: string;
    sentence?: string;
  }>;
}

export interface GradingResponse {
  totalItems: number;
  correctCount: number;
  score: number;
  overallFeedback: string;
  results: Array<{
    itemId: string;
    targetText: string;
    studentText?: string;
    isCorrect: boolean;
    errorHighlight?: string;
    feedback?: string;
  }>;
}

export async function performOcr(
  imageBase64: string,
  language: 'auto' | 'zh' | 'en' = 'auto',
  customInstructions?: string
): Promise<OcrResponse> {
  const res = await fetch('/api/gemini/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, language, customInstructions }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || 'OCR 辨識失敗，請檢查照片清晰度');
  }

  return await res.json();
}

export async function gradePhoto(
  imageBase64: string,
  items: DictationItem[],
  language: LanguageType,
  title?: string
): Promise<GradingResponse> {
  const res = await fetch('/api/gemini/grade-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, items, language, title }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || '相片自動批改失敗，請確保字跡清晰可見');
  }

  return await res.json();
}

export async function gradeTextSubmissions(
  submissions: Array<{ itemId: string; targetText: string; studentInput: string }>,
  language: LanguageType
): Promise<GradingResponse> {
  const res = await fetch('/api/gemini/grade-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissions, language }),
  });

  if (!res.ok) {
    // If backend grading fails, use client-side smart grading as immediate fallback!
    return clientSideSmartGrading(submissions, language);
  }

  return await res.json();
}

// Client-side smart fallback grading to ensure 100% reliability
export function clientSideSmartGrading(
  submissions: Array<{ itemId: string; targetText: string; studentInput: string }>,
  language: LanguageType
): GradingResponse {
  let correctCount = 0;
  const results = submissions.map((sub) => {
    const target = sub.targetText.trim();
    const student = (sub.studentInput || '').trim();

    let isCorrect = false;
    let feedback = '';
    let errorHighlight = '';

    if (language === 'zh') {
      // For Chinese, exact match or normalized match
      isCorrect = target === student;
      if (isCorrect) {
        feedback = '完全正確！';
      } else if (!student) {
        feedback = '未作答';
        errorHighlight = '漏寫';
      } else {
        feedback = `正確寫法為「${target}」`;
        errorHighlight = `寫成「${student}」`;
      }
    } else {
      // English: compare case-insensitively or with punctuation tolerance
      const normTarget = target.toLowerCase().replace(/[.,!?'"]/g, '');
      const normStudent = student.toLowerCase().replace(/[.,!?'"]/g, '');
      isCorrect = normTarget === normStudent;

      if (isCorrect) {
        feedback = 'Great job! Correct spelling!';
      } else if (!student) {
        feedback = 'No answer submitted.';
        errorHighlight = 'Missing';
      } else {
        feedback = `Expected "${target}", you wrote "${student}"`;
        errorHighlight = `Spelling error: ${student}`;
      }
    }

    if (isCorrect) correctCount++;

    return {
      itemId: sub.itemId,
      targetText: target,
      studentText: student,
      isCorrect,
      errorHighlight,
      feedback,
    };
  });

  const total = submissions.length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  let overallFeedback = '';
  if (score === 100) overallFeedback = '太厲害了！滿分 100 分，表現完美無瑕！🎉';
  else if (score >= 80) overallFeedback = '成績優異！只有少數細節需注意，再接再厲！👏';
  else if (score >= 60) overallFeedback = '合格達標！及時溫習錯字，下次必定更上一層樓！💪';
  else overallFeedback = '繼續加油！建議使用「錯題本」多重覆溫習並聽讀幾次！💡';

  return {
    totalItems: total,
    correctCount,
    score,
    overallFeedback,
    results,
  };
}
