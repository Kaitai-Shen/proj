import type { JobStatus } from "../../api/gatewayClient";

/** 主状态中文文案（供徽章与其他页面复用） */
export const STATUS_LABELS: Record<JobStatus, string> = {
  QUEUED: "排队中",
  PLANNING: "规划分镜",
  CODING: "生成代码",
  RENDERING: "渲染动画",
  NARRATING: "生成配音",
  COMPOSING: "合成视频",
  VALIDATING: "校验产物",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const DONE_STATUSES: readonly JobStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

function colorClass(status: JobStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "FAILED":
      return "border-rose-500/50 bg-rose-500/10 text-rose-300";
    case "CANCELLED":
      return "border-white/20 bg-white/5 text-slate-400";
    case "QUEUED":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    default:
      return "border-accent/40 bg-accent/10 text-accent-soft";
  }
}

/** 状态徽章：中文状态文案 + 可选进度百分比 + 修复子状态提示 */
export default function ProgressBadge({
  status,
  percent,
  substatus,
  className,
}: {
  status: JobStatus;
  percent?: number | null;
  substatus?: string | null;
  className?: string;
}) {
  const isDone = DONE_STATUSES.includes(status);
  const running = !isDone && status !== "QUEUED";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClass(status)} ${className ?? ""}`}
    >
      {running && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {STATUS_LABELS[status]}
      {!isDone && status !== "QUEUED" && typeof percent === "number" && (
        <span className="tabular-nums opacity-80">
          {Math.max(0, Math.min(100, percent))}%
        </span>
      )}
      {substatus === "REPAIRING_CODE" && (
        <span className="opacity-80">· 修复代码</span>
      )}
    </span>
  );
}
