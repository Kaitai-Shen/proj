import { useState } from "react";
import { useStudio } from "../../store/studio";
import { EXAMPLES, type Example } from "../../examples";
import { totalFrames } from "../../agents/pipeline";
import TutorialModal from "./Tutorial";

export default function Landing({ onStart }: { onStart: () => void }) {
  const [topic, setTopic] = useState("");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const setStudioTopic = useStudio((s) => s.setTopic);

  const start = () => {
    if (topic.trim()) setStudioTopic(topic.trim());
    onStart();
  };

  const loadExample = (ex: Example) => {
    const st = useStudio.getState();
    st.reset();
    st.setTopic(ex.storyboard.topic);
    st.setAudience(ex.storyboard.audience);
    st.setStoryboard(ex.storyboard);
    st.appendCode(ex.code);
    st.setPhase("done", "演示案例加载完成");
    st.log("system", `已加载演示案例「${ex.title}」（无需 API Key）`);
    st.bumpCodeVersion(0);
    onStart();
  };

  return (
    <div
      className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-6"
      style={{ paddingTop: "calc(56px * var(--site-space, 1))", paddingBottom: "calc(56px * var(--site-space, 1))" }}
    >
      <div className="mb-2 flex items-center gap-3">
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent-soft">
          Planner → Coder → Critic 三智能体协作
        </span>
        <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-400">
          Code-centric：视频即代码
        </span>
      </div>
      <h1
        className="font-bold leading-tight text-slate-100"
        style={{ fontSize: "calc(48px * var(--site-type, 1))" }}
      >
        把任意知识点，
        <br />
        变成一支<span className="text-accent">教学动画视频</span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
        基于 Code2Video 论文的代码中心范式：Planner 设计分镜，Coder 生成可执行的
        Remotion 动画代码并在浏览器实时渲染，Critic 截帧审查布局并自动修正。看完视频还能做小测验验证掌握程度。
      </p>

      <div className="mt-8 flex gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder="输入知识点，如：傅里叶级数、汉诺塔问题、贝叶斯定理…"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent/60 focus:outline-none"
        />
        <button
          onClick={start}
          className="shrink-0 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-ink-950 hover:bg-accent-soft"
        >
          开始创作 →
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        生成需要你自备模型 API Key（仅保存在本地浏览器）· 支持DeepSeek / 通义千问 / OpenAI 等 OpenAI 兼容接口
      </p>
      <button
        onClick={() => setTutorialOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent-soft hover:bg-accent/20"
      >
        📖 第一次用？看新手教程，10 分钟生成第一支视频 →
      </button>

      <div className="mt-10">
        <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500">
          无需 Key · 演示案例（一键回放完整智能体成果）
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              onClick={() => loadExample(ex)}
              className="group rounded-xl border border-white/10 bg-ink-900/60 p-4 text-left transition hover:border-accent/50 hover:bg-accent/5"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-2xl">{ex.emoji}</span>
                <span className="text-[10px] text-slate-600 group-hover:text-accent-soft">
                  点击回放 ▶
                </span>
              </div>
              <div className="text-sm font-medium text-slate-200">{ex.title}</div>
              <div className="mt-1 text-[11px] text-slate-500">{ex.desc}</div>
              <div className="mt-2 text-[10px] text-slate-600">
                {(totalFrames(ex.storyboard) / 30).toFixed(0)} 秒 ·{" "}
                {ex.storyboard.quiz.length} 道测验题
              </div>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-12 text-[11px] text-slate-600">
        方法灵感来自 arXiv 2510.01174《Code2Video: A Code-centric Paradigm for
        Educational Video Generation》（NUS Show Lab）
      </p>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}
