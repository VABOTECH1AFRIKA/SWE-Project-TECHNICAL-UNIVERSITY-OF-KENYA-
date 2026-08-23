import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Trophy, CheckCircle, XCircle, ChevronRight, RotateCcw, ArrowLeft, Sparkles } from 'lucide-react';
import { mockQuizzes } from '@/lib/mockData';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

type Screen = 'list' | 'quiz' | 'results';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export default function Quizzes() {
  const [screen, setScreen] = useState<Screen>('list');
  const [activeQuiz, setActiveQuiz] = useState<typeof mockQuizzes[0] | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);

  const difficultyColor = (d: string) =>
    d === 'Easy' ? C.sage : d === 'Medium' ? C.highlighter : C.coral;
  const difficultyBg = (d: string) =>
    d === 'Easy' ? CA.sage10 : d === 'Medium' ? CA.highlighter15 : CA.coral10;

  const startQuiz = (quiz: typeof mockQuizzes[0]) => {
    setActiveQuiz(quiz);
    setCurrentQ(0);
    setSelected(null);
    setAnswers([]);
    setScore(0);
    setScreen('quiz');
  };

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
  };

  const handleNext = () => {
    if (selected === null || !activeQuiz?.questions_data) return;
    const questions = activeQuiz.questions_data as QuizQuestion[];
    const correct = questions[currentQ].correct;
    const newAnswers = [...answers, selected];
    const newScore = selected === correct ? score + 1 : score;

    if (currentQ < questions.length - 1) {
      setAnswers(newAnswers);
      setScore(newScore);
      setCurrentQ(currentQ + 1);
      setSelected(null);
    } else {
      setAnswers(newAnswers);
      setScore(newScore);
      setScreen('results');
    }
  };

  const resetQuiz = () => {
    setScreen('list');
    setActiveQuiz(null);
    setCurrentQ(0);
    setSelected(null);
    setAnswers([]);
    setScore(0);
  };

  if (screen === 'quiz' && activeQuiz?.questions_data) {
    const questions = activeQuiz.questions_data as QuizQuestion[];
    const q = questions[currentQ];
    const isLast = currentQ === questions.length - 1;
    const progress = ((currentQ) / questions.length) * 100;

    return (
      <>
        <Helmet><title>Quiz — StudyHub AI</title><meta name="description" content="Take a quiz." /><link rel="canonical" href="https://studyhub.ai/quizzes" /></Helmet>
        <div className="p-6 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={resetQuiz} className="p-2 rounded-lg transition-all hover:bg-background" style={{ color: C.inkSoft }}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: C.ink }}>{activeQuiz.title}</p>
              <p className="text-xs" style={{ color: C.inkSoft }}>
                Question {currentQ + 1} of {questions.length}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden mb-8" style={{ background: C.paper }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: C.teal }}
            />
          </div>

          {/* Question */}
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <p className="text-lg font-semibold leading-relaxed" style={{ color: C.ink }}>
              {q.question}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {q.options.map((opt, idx) => {
              let bg: string = C.paperRaised;
              let borderColor: string = C.border;
              let textColor: string = C.ink;
              let icon = null;

              if (selected !== null) {
                if (idx === q.correct) {
                  bg = CA.sage10;
                  borderColor = C.sage;
                  textColor = C.sage;
                  icon = <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: C.sage }} />;
                } else if (idx === selected && idx !== q.correct) {
                  bg = CA.coral10;
                  borderColor = C.coral;
                  textColor = C.coral;
                  icon = <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: C.coral }} />;
                } else {
                  textColor = C.inkSoft;
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={selected !== null}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all"
                  style={{
                    background: bg,
                    border: `1px solid ${borderColor}`,
                    color: textColor,
                    cursor: selected !== null ? 'default' : 'pointer',
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: borderColor + '30', color: textColor }}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {icon}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {selected !== null && (
            <div
              className="rounded-xl p-4 mb-6"
              style={{ background: CA.teal10, border: `1px solid ${C.teal}` }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: C.teal }}>
                AI Explanation
              </p>
              <p className="text-sm" style={{ color: C.ink }}>
                {q.explanation}
              </p>
            </div>
          )}

          {/* Next button */}
          {selected !== null && (
            <button
              onClick={handleNext}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{ background: C.teal }}
            >
              {isLast ? 'See Results' : 'Next Question'}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </>
    );
  }

  if (screen === 'results' && activeQuiz) {
    const questions = (activeQuiz.questions_data as QuizQuestion[]) || [];
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= 70;

    return (
      <>
        <Helmet><title>Quiz Results — StudyHub AI</title><meta name="description" content="Your quiz results." /><link rel="canonical" href="https://studyhub.ai/quizzes" /></Helmet>
        <div className="p-6 max-w-md mx-auto text-center" style={{ fontFamily: 'var(--font-sans)' }}>
          <div
            className="rounded-2xl p-8"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <Trophy
              className="w-16 h-16 mx-auto mb-4"
              style={{ color: passed ? C.sage : C.coral }}
            />
            <h2
              className="text-4xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: passed ? C.sage : C.coral }}
            >
              {pct}%
            </h2>
            <p className="text-base font-semibold mb-1" style={{ color: C.ink }}>
              {passed ? 'Great job!' : 'Keep practicing!'}
            </p>
            <p className="text-sm mb-8" style={{ color: C.inkSoft }}>
              {score} out of {questions.length} correct
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => startQuiz(activeQuiz)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ background: CA.teal10, color: C.teal }}
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={resetQuiz}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: C.teal, color: 'white' }}
              >
                Back to Quizzes
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // List view
  return (
    <>
      <Helmet><title>Quizzes — StudyHub AI</title><meta name="description" content="AI-generated quizzes from your course materials with instant feedback." /><link rel="canonical" href="https://studyhub.ai/quizzes" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            Quizzes
          </h1>
          <p className="text-sm" style={{ color: C.inkSoft }}>
            AI-generated quizzes from your course materials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="rounded-xl p-5 transition-all hover:shadow-md"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {quiz.aiGenerated && (
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
                      style={{ background: CA.teal10, color: C.teal }}
                    >
                      <Sparkles className="w-3 h-3" />
                      AI Generated
                    </span>
                  )}
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: difficultyBg(quiz.difficulty), color: difficultyColor(quiz.difficulty) }}
                  >
                    {quiz.difficulty}
                  </span>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                  style={{ background: courseColorAlpha[quiz.course], color: courseColors[quiz.course] }}
                >
                  {quiz.course}
                </span>
              </div>

              <h3 className="text-base font-semibold mb-1" style={{ color: C.ink }}>
                {quiz.title}
              </h3>
              <p className="text-xs mb-4" style={{ color: C.inkSoft }}>
                {quiz.questionCount} questions · {quiz.duration} min
                {quiz.bestScore !== null && ` · Best: ${quiz.bestScore}%`}
              </p>

              <div className="flex items-center justify-between">
                {quiz.bestScore !== null && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: C.paper }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${quiz.bestScore}%`, background: C.teal }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: C.inkSoft }}>{quiz.bestScore}%</span>
                  </div>
                )}
                <button
                  onClick={() => quiz.questions_data ? startQuiz(quiz) : undefined}
                  disabled={!quiz.questions_data}
                  className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: quiz.questions_data ? C.teal : C.paper,
                    color: quiz.questions_data ? 'white' : C.inkSoft,
                    border: quiz.questions_data ? 'none' : `1px solid ${C.border}`,
                    cursor: quiz.questions_data ? 'pointer' : 'not-allowed',
                    opacity: quiz.questions_data ? 1 : 0.6,
                  }}
                >
                  {quiz.bestScore !== null ? 'Retake' : 'Start Quiz'}
                  {!quiz.questions_data && ' (Demo)'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-6 rounded-xl px-4 py-3 text-sm"
          style={{ background: CA.teal10, color: C.teal }}
        >
          Only the Binary Trees quiz has demo questions. Full quiz generation requires AI backend integration.
        </div>
      </div>
    </>
  );
}
