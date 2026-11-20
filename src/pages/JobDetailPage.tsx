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
import {
  ArrowLeft,
  Clock,
  FileText,
  Film,
  Folder,
  Layers,
  Refresh,
} from "../components/ui/Icons";

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
        <main className="animate-enter mx-auto w-full max-w-2xl px-5 py-24 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-card text-ink-faint">
            <Folder size={24} />
          </span>
          <h1 className="font-display mt-5 text-2xl font-semibold text-ink">
            找不到这条任务
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            任务 ID「{id}」没有对应记录，可能链接有误或任务已清理。
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Link to="/" className="btn-primary">
              <ArrowLeft size={15} /> 返回创建任务
            </Link>
            <Link to="/history" className="btn-secondary">
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
        <main className="mx-auto w-full max-w-4xl px-5 py-10">
          <div className="card-surface space-y-4 p-6">
            <div className="skeleton h-6 w-2/5" />
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton mt-4 h-9 w-full" />
            <div className="skeleton h-2.5 w-full" />
          </div>
          <div className="card-surface mt-5 space-y-4 p-6">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton aspect-video w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-full">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl px-5 py-10">
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
      <main className="mx-auto w-full max-w-4xl px-5 py-10">
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

        <section className="card-surface animate-enter p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow flex items-center gap-1.5">
                <Film size={12} /> 生成任务
              </p>
              <h1 className="font-display mt-1.5 line-clamp-2 text-2xl font-semibold leading-snug text-ink sm:text-3xl">
                {job.topic}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-ink-faint">
                <span>{job.job_id}</span>
                <span>·</span>
                <span>创建于 {formatTime(job.created_at)}</span>
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
                  className="btn-danger"
                >
                  {cancelling ? "取消中…" : "取消任务"}
                </button>
              )}
            </div>
          </div>
          {cancelHint && (
            <p className="mt-2 text-xs text-warning">{cancelHint}</p>
          )}

          <div className="mt-7">
            <StatusStepper status={job.status} />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <Refresh size={12} />
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
            <div className="mt-2 h-2.5 overflow-hidden rounded-pill bg-oat">
              <div
                className={`h-full rounded-pill transition-all duration-700 ${
                  failed ? "bg-danger" : "bg-clay"
                }`}
                style={{
                  width: `${job.status === "COMPLETED" ? 100 : progress}%`,
                }}
              />
            </div>
            {!failed && job.status !== "COMPLETED" && (
              <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-ink-faint">
                {progress}%
              </p>
            )}
          </div>

          {failed && job.error && (
            <div className="tone-danger mt-5 rounded-card-sm border px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <span>任务失败</span>
                <span className="font-mono text-xs opacity-80">
                  {job.error.code}
                </span>
              </div>
              <div className="mt-1 text-xs leading-relaxed opacity-90">
                {job.error.message}
              </div>
            </div>
          )}
        </section>

        <section
          className="card-surface animate-enter enter-2 mt-5 p-5 sm:p-7"
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <Layers size={15} />
            产物
            <span className="font-normal text-ink-faint">
              {job.artifacts.length > 0 ? `· ${job.artifacts.length} 项` : ""}
            </span>
          </h2>
          <ArtifactList
            job={job}
            storyboardOpen={storyboardOpen}
            onToggleStoryboard={() => void toggleStoryboard()}
          />

          {storyboardOpen && (
            <div className="animate-enter-fast mt-5 border-t border-line pt-5">
              {storyboardLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-16 w-full" />
                  <div className="skeleton h-16 w-full" />
                </div>
              ) : storyboardError ? (
                storyboardError.status === 404 ? (
                  <p className="text-xs text-ink-muted">
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
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {storyboard.title}
                    <span className="ml-2 font-sans text-xs font-normal text-ink-muted">
                      共 {storyboard.scenes.length} 个场景 · 目标{" "}
                      {storyboard.target_seconds} 秒
                    </span>
                  </h3>
                  {storyboard.learning_objectives.length > 0 && (
                    <ul className="mt-2.5 list-disc space-y-1 pl-5 text-xs text-ink-soft">
                      {storyboard.learning_objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  )}
                  <ol className="mt-4 space-y-2.5">
                    {storyboard.scenes.map((scene, i) => (
                      <li
                        key={scene.scene_id}
                        className="card-inset p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-clay text-[10px] font-semibold text-clay-on">
                            {i + 1}
                          </span>
                          <span className="font-mono text-[10px] text-ink-faint">
                            {scene.scene_id}
                          </span>
                          <span className="font-medium text-ink">
                            {scene.concept}
                          </span>
                          <span className="ml-auto flex items-center gap-1 text-[10px] tabular-nums text-ink-faint">
                            <Clock size={11} /> ≈{scene.estimated_seconds}s
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                          旁白：{scene.narration}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                          画面：{scene.visual_instructions}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <details className="group mt-4">
                    <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-muted hover:text-ink">
                      <FileText size={12} />
                      原始 JSON
                    </summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-card-sm border border-line bg-[#1b1a17] p-3 font-mono text-[10px] leading-relaxed text-[#d6d3c8]">
                      {JSON.stringify(storyboard, null, 2)}
                    </pre>
                  </details>
                </>
              ) : null}
            </div>
          )}
        </section>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-ink-faint">
          <Refresh size={11} />
          状态每 2 秒自动刷新（{STATUS_LABELS[job.status]}）
        </p>
      </main>
    </div>
  );
}
