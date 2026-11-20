import { useState } from "react";
import { Link } from "react-router-dom";
import { useStudio } from "../../store/studio";
import { EXAMPLES, type Example } from "../../examples";
import { totalFrames } from "../../agents/pipeline";
import TutorialModal from "./Tutorial";
import HeroFigure from "../ui/HeroFigure";
import WavePoster from "../ui/WavePoster";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Play,
  Sparkles,
  Wave,
} from "../ui/Icons";

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
    <div className="mx-auto w-full max-w-page px-5 pb-16 pt-10 sm:pt-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-enter">
          <div className="flex flex-wrap gap-2">
            <span className="pill-clay">
              <Sparkles size={13} />
              Planner → Coder → Critic 三智能体协作
            </span>
            <span className="pill">Code-centric · 视频即代码</span>
          </div>

          <h1 className="font-display mt-5 text-[34px] font-semibold leading-[1.12] text-ink sm:text-[52px]">
            把任意知识点，
            <br />
            变成一支
            <span className="relative inline-block text-clay-deep">
              教学动画视频
              <svg
                viewBox="0 0 220 10"
                className="absolute -bottom-1.5 left-0 h-2 w-full"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6.5C46 3 104 2.5 218 5"
                  fill="none"
                  stroke="var(--site-accent)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            基于 Code2Video 论文的代码中心范式：Planner 设计分镜，Coder
            生成可执行的 Remotion 动画代码并在浏览器实时渲染，Critic
            截帧审查布局并自动修正。看完视频还能做小测验验证掌握程度。
          </p>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="输入知识点，如：傅里叶级数、汉诺塔问题、贝叶斯定理…"
              className="field-input min-w-0 flex-1"
            />
            <button onClick={start} className="btn-primary shrink-0 px-6">
              开始创作 <ArrowRight size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            生成需要你自备模型 API
            Key（仅保存在本地浏览器）· 支持 DeepSeek / 通义千问 / OpenAI 等 OpenAI
            兼容接口
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              onClick={() => setTutorialOpen(true)}
              className="btn-secondary px-3.5 py-2 text-xs"
            >
              <BookOpen size={14} /> 第一次用？看新手教程
            </button>
            <Link
              to="/"
              className="link-ink inline-flex items-center gap-1 text-xs"
            >
              <ArrowLeft size={13} /> 返回服务端生成
            </Link>
          </div>
        </div>

        <div className="animate-enter enter-2 hidden lg:block">
          <HeroFigure />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow">无需 Key</p>
            <h2 className="font-display mt-1 text-2xl font-semibold text-ink">
              演示案例
            </h2>
          </div>
          <p className="text-xs text-ink-muted">点击卡片，一键回放完整智能体成果</p>
        </div>

        <div className="mt-5 max-w-3xl space-y-4">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              onClick={() => loadExample(ex)}
              className="card-surface lift group flex w-full flex-col gap-4 p-4 text-left hover:border-line-strong sm:flex-row sm:items-center"
            >
              <div className="w-full shrink-0 sm:w-72">
                <WavePoster
                  caption={`${(totalFrames(ex.storyboard) / 30).toFixed(0)} 秒 · ${ex.storyboard.quiz.length} 道测验`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay text-clay-on">
                    <Wave size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-ink">
                      {ex.title}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {ex.desc}
                    </div>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-faint transition group-hover:border-clay group-hover:text-clay-deep">
                    <Play size={13} />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="pill py-0.5">
                    <Play size={11} /> 点击回放
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    无需 API Key · 浏览器内即时渲染
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <p className="mt-12 text-[11px] leading-relaxed text-ink-faint">
        方法灵感来自 arXiv 2510.01174《Code2Video: A Code-centric Paradigm for
        Educational Video Generation》（NUS Show Lab）
      </p>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}
