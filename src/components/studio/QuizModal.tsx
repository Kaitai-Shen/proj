import { useState } from "react";
import { useStudio } from "../../store/studio";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-ink-800 p-6 shadow-2xl">
        {!finished ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-accent-soft">
                TeachQuiz 课后测验 · 第 {idx + 1}/{quiz.length} 题
              </span>
              <button onClick={close} className="text-slate-500 hover:text-slate-300">
                ✕
              </button>
            </div>
            <p className="mb-4 text-lg text-slate-100">{q.question}</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => {
                const isAnswer = i === q.answerIndex;
                const isPicked = i === picked;
                const base = "rounded-lg border px-4 py-3 text-left text-sm transition";
                const style =
                  picked === null
                    ? "border-white/15 bg-white/[0.03] text-slate-300 hover:border-accent/60 hover:bg-accent/10"
                    : isAnswer
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : isPicked
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-300"
                        : "border-white/10 bg-white/[0.02] text-slate-500";
                return (
                  <button key={i} onClick={() => pick(i)} disabled={picked !== null} className={`${base} ${style}`}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </button>
                );
              })}
            </div>
            {picked !== null ? (
              <div className="mt-4">
                <p className="mb-3 text-xs leading-relaxed text-slate-400">
                  {q.explanation}
                </p>
                <button
                  onClick={next}
                  className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-accent-soft"
                >
                  {idx + 1 >= quiz.length ? "查看成绩" : "下一题"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-2 text-center text-5xl">
              {score === quiz.length ? "🏆" : score >= quiz.length / 2 ? "👍" : "💪"}
            </div>
            <p className="mb-1 text-center text-xl font-semibold text-slate-100">
              {score} / {quiz.length}
            </p>
            <p className="mb-6 text-center text-xs text-slate-500">
              {score === quiz.length
                ? "满分！你已经掌握了这个知识点"
                : score >= quiz.length / 2
                  ? "不错，可以回看视频巩固薄弱环节"
                  : "建议回看视频，重点关注讲公式和例子的部分"}
            </p>
            <button
              onClick={close}
              className="w-full rounded-lg bg-white/10 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/20"
            >
              关闭
            </button>
          </>
        )}
      </div>
    </div>
  );
}
