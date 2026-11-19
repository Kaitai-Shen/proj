import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GatewayError,
  createJob,
  type Audience,
} from "../api/gatewayClient";
import ErrorCard from "../components/gateway/ErrorCard";
import SiteHeader from "../components/gateway/SiteHeader";
import TutorialModal from "../components/studio/Tutorial";

const TOPIC_MIN = 5;
const TOPIC_MAX = 500;
const DURATION_MIN = 15;
const DURATION_MAX = 90;
const DURATION_STEP = 5;

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "beginner", label: "beginner · 零基础入门" },
  { value: "intermediate", label: "intermediate · 有一定基础" },
];

/** 创建生成任务页（设计文档 §5.1）：topic / audience / duration / language(zh-CN 只读) */
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
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent-soft">
            服务端生成 · Planner → Coder → Critic
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-400">
            Manim 渲染 · 15–90 秒数学/算法动画
          </span>
        </div>
        <h1 className="text-3xl font-bold leading-tight text-slate-100">
          把任意知识点，
          <br />
          变成一支<span className="text-accent">教学动画视频</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          描述一个知识点，服务端多智能体自动完成分镜规划、Manim
          代码生成、逐场景渲染与合成。提交后进入任务页实时查看进度。
        </p>
        <button
          onClick={() => setTutorialOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent-soft hover:bg-accent/20"
        >
          📖 第一次用？看新手教程 →
        </button>

        {error && (
          <div className="mt-6">
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
          className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-ink-900/60 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="topic"
                className="text-xs font-medium text-slate-400"
              >
                知识点描述
              </label>
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  tooShort || tooLong ? "text-amber-400" : "text-slate-600"
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
              className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-accent/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="audience"
                className="text-xs font-medium text-slate-400"
              >
                目标观众
              </label>
              <select
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-ink-800 px-3 py-2.5 text-sm text-slate-200 focus:border-accent/60 focus:outline-none"
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="language"
                className="text-xs font-medium text-slate-400"
              >
                语言
              </label>
              <input
                id="language"
                value="中文（zh-CN）"
                readOnly
                disabled
                className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-slate-500"
              />
              <p className="mt-1 text-[10px] text-slate-600">
                当前版本固定简体中文
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="duration"
                className="text-xs font-medium text-slate-400"
              >
                视频时长
              </label>
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-accent-soft">
                {duration} 秒
              </span>
            </div>
            <input
              id="duration"
              type="range"
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={DURATION_STEP}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-2.5 w-full accent-[var(--site-accent)]"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>{DURATION_MIN} 秒</span>
              <span>{DURATION_MAX} 秒</span>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full rounded-xl px-6 py-3 text-sm font-semibold transition ${
                canSubmit
                  ? "bg-accent text-ink-950 hover:bg-accent-soft"
                  : "cursor-not-allowed bg-white/10 text-slate-500"
              }`}
            >
              {submitting ? "正在创建任务…" : "开始生成 →"}
            </button>
            <p className="mt-2 text-center text-[10px] text-slate-600">
              创建后自动跳转任务页，实时展示 排队 → 规划 → 编码 → 渲染 → 合成 → 校验 进度
            </p>
          </div>
        </form>

        <Link
          to="/demo"
          className="group mt-8 flex items-center gap-4 rounded-2xl border border-white/10 bg-ink-900/60 p-4 transition hover:border-accent/50 hover:bg-accent/5"
        >
          <span className="text-3xl">🌊</span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-200 group-hover:text-accent-soft">
              傅里叶级数演示案例
            </div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              生成服务未启动？在浏览器内完整回放
              Planner→Coder→Critic 三智能体生成动画的全过程（无需 API Key、无需后端）。
            </div>
          </div>
          <span className="ml-auto shrink-0 text-slate-600 group-hover:text-accent-soft">
            →
          </span>
        </Link>

        <p className="mt-8 text-[11px] text-slate-600">
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
