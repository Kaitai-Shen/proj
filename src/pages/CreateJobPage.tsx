import { useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GatewayError,
  createJob,
  type Audience,
} from "../api/gatewayClient";
import ErrorCard from "../components/gateway/ErrorCard";
import SiteHeader from "../components/gateway/SiteHeader";
import TutorialModal from "../components/studio/Tutorial";
import HeroFigure from "../components/ui/HeroFigure";
import WavePoster from "../components/ui/WavePoster";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Code,
  Layers,
  Loader,
  Play,
  Sparkles,
} from "../components/ui/Icons";

const TOPIC_MIN = 5;
const TOPIC_MAX = 500;
const DURATION_MIN = 15;
const DURATION_MAX = 90;
const DURATION_STEP = 5;
const DURATION_PRESETS = [30, 45, 60, 90];

const AUDIENCE_OPTIONS: {
  value: Audience;
  label: string;
  hint: string;
}[] = [
  { value: "beginner", label: "零基础入门", hint: "从直觉和例子讲起" },
  { value: "intermediate", label: "有一定基础", hint: "可以直接讲公式与推导" },
];

const EXAMPLE_TOPICS = [
  {
    label: "二分查找",
    topic:
      "介绍二分查找算法——它如何在有序数组中每一步排除一半的搜索区间",
  },
  {
    label: "贝叶斯定理",
    topic:
      "用天气预报的例子解释贝叶斯定理：先验、似然与后验分别意味着什么",
  },
  {
    label: "傅里叶级数",
    topic: "傅里叶级数如何把一条复杂曲线拆成简单正弦波的叠加",
  },
  {
    label: "汉诺塔",
    topic: "汉诺塔的递归解法：为什么移动 n 个盘子需要 2^n - 1 步",
  },
];

const PIPELINE = [
  { icon: Sparkles, label: "Planner", desc: "设计分镜与讲解脚本" },
  { icon: Code, label: "Coder", desc: "生成可执行的 Manim 代码" },
  { icon: Layers, label: "Critic", desc: "审查画面并定向修复" },
];

/** 创建生成任务页：topic / audience / duration / language(zh-CN 只读) */
export default function CreateJobPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState<Audience>("beginner");
  const [duration, setDuration] = useState(45);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<GatewayError | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const trimmed = topic.trim();
  const tooShort = trimmed.length < TOPIC_MIN;
  const tooLong = topic.length > TOPIC_MAX;
  const canSubmit = !submitting && !tooShort && !tooLong;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createJob({
        topic: trimmed,
        audience,
        language: "zh-CN",
        duration_seconds: duration,
      });
      navigate(`/jobs/${res.job_id}`);
    } catch (err) {
      setError(
        err instanceof GatewayError
          ? err
          : new GatewayError("network", "生成服务未启动或不可达"),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto w-full max-w-page px-5 pb-16 pt-10 sm:pt-14">
        <section className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="animate-enter">
            <div className="flex flex-wrap gap-2">
              <span className="pill-clay">
                <Sparkles size={13} />
                多智能体 · Planner → Coder → Critic
              </span>
              <span className="pill">
                <Play size={12} />
                Manim 渲染 · 15–90 秒
              </span>
            </div>

            <h1 className="font-display mt-5 text-[34px] font-semibold leading-[1.12] text-ink sm:text-[54px]">
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
              描述一个知识点，服务端多智能体自动完成分镜规划、Manim
              代码生成、逐场景渲染与合成。提交后进入任务页实时查看进度。
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setTutorialOpen(true)}
                className="btn-secondary px-3.5 py-2 text-xs"
              >
                <BookOpen size={14} />
                第一次用？看新手教程
              </button>
              <Link
                to="/demo"
                className="link-ink inline-flex items-center gap-1 text-sm"
              >
                先看一支成品 <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="mt-9">
              <p className="eyebrow">不知道写什么？试试这些</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {EXAMPLE_TOPICS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setTopic(t.topic)}
                    className="pill hover-wash transition hover:border-clay hover:text-ink"
                    title={t.topic}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="animate-enter enter-2 hidden lg:block">
            <HeroFigure />
          </div>
        </section>

        <section className="mt-12 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="animate-enter enter-3">
            {error && (
              <div className="mb-4">
                <ErrorCard
                  kind={error.kind === "network" ? "network" : "http"}
                  title={
                    error.kind === "network"
                      ? "生成服务未启动或不可达"
                      : "任务创建失败"
                  }
                  message={error.message}
                  detail={error.code ? `错误码 ${error.code}` : undefined}
                />
              </div>
            )}

            <form
              className="card-surface p-5 sm:p-7"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="mb-6 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-ink">
                  描述你想讲清楚的知识点
                </h2>
                <span className="text-[11px] text-ink-faint">约 1 分钟</span>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="topic" className="field-label">
                    知识点描述
                  </label>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      tooShort || tooLong ? "text-warning" : "text-ink-faint"
                    }`}
                  >
                    {topic.length} / {TOPIC_MAX}
                    {tooShort && " · 至少 5 字"}
                    {tooLong && " · 超出上限"}
                  </span>
                </div>
                <textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={4}
                  placeholder="例如：介绍二分查找算法——它如何在有序数组中每一步排除一半的搜索区间"
                  className="field-input mt-2 resize-none leading-relaxed"
                />
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <fieldset>
                  <legend className="field-label">目标观众</legend>
                  <div className="mt-2 grid grid-cols-2 gap-1 rounded-btn border border-line bg-canvas p-1">
                    {AUDIENCE_OPTIONS.map((opt) => {
                      const active = audience === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setAudience(opt.value)}
                          className={`rounded-lg px-2.5 py-2 text-left text-xs leading-tight transition ${
                            active
                              ? "border border-line bg-card text-ink"
                              : "border border-transparent text-ink-muted hover:text-ink"
                          }`}
                        >
                          <span className="block font-medium">{opt.label}</span>
                          <span className="mt-0.5 block text-[10px] opacity-70">
                            {opt.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div>
                  <span className="field-label">语言</span>
                  <div className="mt-2 flex h-[52px] items-center gap-2 rounded-btn border border-line bg-canvas px-3.5 text-sm text-ink-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    简体中文 · zh-CN
                  </div>
                  <p className="mt-1 text-[10px] text-ink-faint">
                    当前版本固定简体中文
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <label htmlFor="duration" className="field-label">
                    视频时长
                  </label>
                  <span className="pill-clay tabular-nums">{duration} 秒</span>
                </div>
                <input
                  id="duration"
                  type="range"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={DURATION_STEP}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="slider mt-3"
                  style={
                    {
                      "--range-fill": `${((duration - DURATION_MIN) / (DURATION_MAX - DURATION_MIN)) * 100}%`,
                    } as CSSProperties
                  }
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {DURATION_PRESETS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={`rounded-pill border px-2.5 py-0.5 text-[11px] tabular-nums transition ${
                          duration === d
                            ? "border-clay text-clay-deep"
                            : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-ink-faint">
                    {DURATION_MIN}–{DURATION_MAX} 秒
                  </span>
                </div>
              </div>

              <div className="mt-7">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary w-full py-3"
                >
                  {submitting ? (
                    <>
                      <Loader size={16} /> 正在创建任务…
                    </>
                  ) : tooShort ? (
                    "输入至少 5 个字即可开始"
                  ) : tooLong ? (
                    "描述超出上限"
                  ) : (
                    <>
                      开始生成 <ArrowRight size={16} />
                    </>
                  )}
                </button>
                <p className="mt-2.5 text-center text-[10px] leading-relaxed text-ink-faint">
                  创建后自动跳转任务页，实时展示 排队 → 规划 → 编码 → 渲染 →
                  合成 → 校验 进度
                </p>
              </div>
            </form>
          </div>

          <aside className="animate-enter enter-4 space-y-4">
            <Link
              to="/demo"
              className="card-surface lift group block overflow-hidden p-3"
            >
              <WavePoster caption="41 秒 · 4 个分镜 · 3 道测验" />
              <div className="flex items-start gap-3 px-1.5 pb-1 pt-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay text-clay-on">
                  <Play size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm font-semibold text-ink">
                    傅里叶级数演示案例
                    <ArrowUpRight
                      size={13}
                      className="text-ink-faint transition group-hover:text-clay-deep"
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                    生成服务未启动？在浏览器内完整回放三智能体生成动画的全过程，无需
                    API Key、无需后端。
                  </p>
                </div>
              </div>
            </Link>

            <div className="card-inset p-5">
              <p className="eyebrow">生成流程</p>
              <ol className="mt-3 space-y-3">
                {PIPELINE.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label} className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-soft">
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-ink">
                          {i + 1}. {item.label}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {item.desc}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </section>

        <p className="mt-10 text-[11px] leading-relaxed text-ink-faint">
          方法灵感来自 arXiv 2510.01174《Code2Video: A Code-centric Paradigm for
          Educational Video Generation》（NUS Show Lab）
        </p>
      </main>

      <TutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />
    </div>
  );
}
