import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  GatewayError,
  cancelJob,
  getStoryboard,
  type JobStatus,
  type LessonPlan,
} from "../api/gatewayClient";
import { useJobPolling } from "../api/useJobPolling";
import ArtifactList from "../components/gateway/ArtifactList";
import ErrorCard from "../components/gateway/ErrorCard";
import ProgressBadge, { STATUS_LABELS } from "../components/gateway/ProgressBadge";
import SiteHeader from "../components/gateway/SiteHeader";
import StatusStepper from "../components/gateway/StatusStepper";

const CANCELABLE_STATUSES: readonly JobStatus[] = ["QUEUED", "PLANNING"];

/** 进行中阶段的说明文案（progress 条下方左侧） */
const PHASE_HINTS: Record<JobStatus, string> = {
  QUEUED: "任务已入队，等待调度",
  PLANNING: "正在设计分镜与讲解脚本",
  CODING: "正在生成 Manim 动画代码",
  RENDERING: "正在逐场景渲染动画",
  NARRATING: "正在生成配音",
  COMPOSING: "正在合并场景视频",
  VALIDATING: "正在校验产物完整性",
  COMPLETED: "全部完成，可播放与下载",
  FAILED: "任务失败",
  CANCELLED: "任务已取消",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("zh-CN", { hour12: false });
}

/** 任务详情页：2s 轮询 + 状态步进条 + 产物（成片播放/分镜/场景缩略/日志下载） */
export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { job, refreshError, loading, notFound, refresh } = useJobPolling(id);

  const [cancelling, setCancelling] = useState(false);
  const [cancelHint, setCancelHint] = useState<string | null>(null);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [storyboard, setStoryboard] = useState<LessonPlan | null>(null);
  const [storyboardError, setStoryboardError] = useState<GatewayError | null>(
    null,
  );
  const [storyboardLoading, setStoryboardLoading] = useState(false);

  const toggleStoryboard = async (): Promise<void> => {
    if (!job) return;
    if (storyboardOpen && storyboard) {
      setStoryboardOpen(false);
      return;
    }
    setStoryboardOpen(true);
    if (storyboard) return; // 已加载，仅展开
    setStoryboardLoading(true);
    setStoryboardError(null);
    try {
      setStoryboard(await getStoryboard(job.job_id));
    } catch (err) {
      setStoryboardError(
        err instanceof GatewayError
          ? err
          : new GatewayError("network", "分镜加载失败"),
      );
    } finally {
      setStoryboardLoading(false);
    }
  };

  const cancel = async (): Promise<void> => {
    if (!job || cancelling) return;
    setCancelling(true);
    setCancelHint(null);
    try {
      await cancelJob(job.job_id);
      refresh();
    } catch (err) {
      const ge =
        err instanceof GatewayError
          ? err
          : new GatewayError("network", "取消请求发送失败");
      setCancelHint(
        ge.status === 409
          ? "当前状态已不可取消（任务可能已开始处理或已结束）。"
          : ge.message,
      );
    } finally {
      setCancelling(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-full">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl px-4 py-20 text-center">
          <div className="text-4xl">🗂️</div>
          <h1 className="mt-3 text-lg font-semibold text-slate-200">
            任务不存在
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            任务 ID「{id}」没有对应记录，可能链接有误或任务已清理。
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-soft"
            >
              ← 返回创建任务
            </Link>
            <Link
              to="/history"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              查看任务历史
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (loading && !job) {
    return (
      <div className="min-h-full">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="py-20 text-center text-sm text-slate-500">
            正在加载任务…
          </p>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-full">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <ErrorCard
            kind="network"
            title="任务加载失败"
            message="无法连接生成服务，请确认后端已启动后重试。"
            onRetry={refresh}
          />
        </main>
      </div>
    );
  }

  const cancelable = CANCELABLE_STATUSES.includes(job.status);
  const failed = job.status === "FAILED";
  const repairing = job.substatus === "REPAIRING_CODE";
  const progress = Math.max(0, Math.min(100, job.progress_percent));

  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {/* 网络刷新失败提示：与任务自身 error 严格区分，不覆盖任务数据 */}
        {refreshError && (
          <div className="mb-4">
            <ErrorCard
              kind="network"
              title="刷新失败：生成服务不可达"
              message="正在自动重试，下方为最近一次成功获取的任务状态。"
              onRetry={refresh}
            />
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-ink-900/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-100">
                {job.topic}
              </h1>
              <p className="mt-1 font-mono text-[10px] text-slate-600">
                {job.job_id} · 创建于 {formatTime(job.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ProgressBadge
                status={job.status}
                percent={job.progress_percent}
                substatus={job.substatus}
              />
              {cancelable && (
                <button
                  onClick={() => void cancel()}
                  disabled={cancelling}
                  className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {cancelling ? "取消中…" : "取消任务"}
                </button>
              )}
            </div>
          </div>
          {cancelHint && (
            <p className="mt-2 text-xs text-amber-300">{cancelHint}</p>
          )}

          <div className="mt-4">
            <StatusStepper status={job.status} />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {repairing
                  ? "正在修复代码（渲染失败定向修复）"
                  : job.substatus
                    ? `子状态：${job.substatus}`
                    : PHASE_HINTS[job.status]}
              </span>
              <span className="tabular-nums">
                {job.current_scene != null && job.scene_count != null
                  ? `场景 ${job.current_scene} / ${job.scene_count}`
                  : ""}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  failed ? "bg-rose-500" : "bg-accent"
                }`}
                style={{
                  width: `${job.status === "COMPLETED" ? 100 : progress}%`,
                }}
              />
            </div>
            {!failed && job.status !== "COMPLETED" && (
              <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-slate-600">
                {progress}%
              </p>
            )}
          </div>

          {failed && job.error && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <div className="font-medium">
                任务失败
                <span className="ml-2 font-mono text-xs opacity-90">
                  {job.error.code}
                </span>
              </div>
              <div className="mt-1 text-xs leading-relaxed opacity-90">
                {job.error.message}
              </div>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-ink-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">
            产物 Artifacts
          </h2>
          <ArtifactList
            job={job}
            storyboardOpen={storyboardOpen}
            onToggleStoryboard={() => void toggleStoryboard()}
          />

          {storyboardOpen && (
            <div className="mt-4 border-t border-white/10 pt-4">
              {storyboardLoading ? (
                <p className="text-xs text-slate-500">正在加载分镜…</p>
              ) : storyboardError ? (
                storyboardError.status === 404 ? (
                  <p className="text-xs text-slate-500">
                    分镜尚未生成（NOT_READY）。
                  </p>
                ) : (
                  <ErrorCard
                    kind={storyboardError.kind === "network" ? "network" : "http"}
                    title="分镜加载失败"
                    message={storyboardError.message}
                    onRetry={() => void toggleStoryboard()}
                  />
                )
              ) : storyboard ? (
                <>
                  <h3 className="text-xs font-semibold text-slate-300">
                    {storyboard.title} · 共 {storyboard.scenes.length} 个场景 ·
                    目标 {storyboard.target_seconds} 秒
                  </h3>
                  {storyboard.learning_objectives.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-400">
                      {storyboard.learning_objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  )}
                  <ol className="mt-3 space-y-2">
                    {storyboard.scenes.map((scene) => (
                      <li
                        key={scene.scene_id}
                        className="rounded-xl border border-white/10 bg-ink-800/60 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent-soft">
                            {scene.scene_id}
                          </span>
                          <span className="font-medium text-slate-200">
                            {scene.concept}
                          </span>
                          <span className="ml-auto text-[10px] tabular-nums text-slate-600">
                            ≈{scene.estimated_seconds}s
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                          旁白：{scene.narration}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                          画面：{scene.visual_instructions}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                      原始 JSON
                    </summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-slate-400">
                      {JSON.stringify(storyboard, null, 2)}
                    </pre>
                  </details>
                </>
              ) : null}
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-[10px] text-slate-600">
          状态每 2 秒自动刷新（{STATUS_LABELS[job.status]}）
        </p>
      </main>
    </div>
  );
}
