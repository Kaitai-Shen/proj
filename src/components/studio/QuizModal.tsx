import { useState } from "react";
import { useStudio } from "../../store/studio";
import {
  BookOpen,
  CheckCircle,
  MessageSquare,
  Trophy,
  X,
} from "../ui/Icons";

export default function QuizModal() {
  const show = useStudio((s) => s.showQuiz);
  const quiz = useStudio((s) => s.quiz);
  const setShowQuiz = useStudio((s) => s.setShowQuiz);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!show || quiz.length === 0) return null;

  const q = quiz[idx];

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answerIndex) setScore((v) => v + 1);
  };

  const next = () => {
    if (idx + 1 >= quiz.length) {
      setFinished(true);
    } else {
      setIdx(idx + 1);
      setPicked(null);
    }
  };

  const close = () => {
    setShowQuiz(false);
    setIdx(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  const ResultIcon =
    score === quiz.length ? Trophy : score >= quiz.length / 2 ? CheckCircle : BookOpen;

  return (
    <div className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/45 p-4 backdrop-blur-sm">
      <div
        className="animate-modal card-surface w-full max-w-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-label="课后测验"
      >
        {!finished ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="pill-clay">
                <MessageSquare size={12} />
                课后测验 · 第 {idx + 1}/{quiz.length} 题
              </span>
              <button
                onClick={close}
                className="btn-ghost rounded-full p-2"
                aria-label="关闭测验"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mb-4 h-1 overflow-hidden rounded-pill bg-oat">
              <div
                className="h-full rounded-pill bg-clay transition-all duration-500"
                style={{ width: `${((idx + (picked !== null ? 1 : 0)) / quiz.length) * 100}%` }}
              />
            </div>
            <p className="font-display mb-4 text-xl leading-snug text-ink">
              {q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => {
                const isAnswer = i === q.answerIndex;
                const isPicked = i === picked;
                const base =
                  "flex items-center gap-3 rounded-btn border px-4 py-3 text-left text-sm transition";
                const style =
                  picked === null
                    ? "border-line bg-canvas text-ink-soft hover:border-clay hover:text-ink"
                    : isAnswer
                      ? "tone-success"
                      : isPicked
                        ? "tone-danger"
                        : "border-line bg-canvas text-ink-faint";
                return (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    disabled={picked !== null}
                    className={`${base} ${style}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {picked !== null ? (
              <div className="animate-enter-fast mt-4">
                <p className="mb-3 rounded-card-sm bg-canvas p-3 text-xs leading-relaxed text-ink-muted">
                  {q.explanation}
                </p>
                <button onClick={next} className="btn-primary w-full py-2.5">
                  {idx + 1 >= quiz.length ? "查看成绩" : "下一题"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-line bg-canvas text-clay-deep">
              <ResultIcon size={30} />
            </span>
            <p className="font-display mt-4 text-4xl font-semibold text-ink">
              {score} <span className="text-lg text-ink-faint">/ {quiz.length}</span>
            </p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">
              {score === quiz.length
                ? "满分！你已经掌握了这个知识点"
                : score >= quiz.length / 2
                  ? "不错，可以回看视频巩固薄弱环节"
                  : "建议回看视频，重点关注讲公式和例子的部分"}
            </p>
            <button onClick={close} className="btn-secondary mt-6 w-full py-2.5">
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
