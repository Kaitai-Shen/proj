import type { JobStatus } from "../../api/gatewayClient";

interface StepDef {
  key: string;
  label: string;
}

/** P0 状态机（契约 §1）：NARRATING 阶段被跳过，步进条不展示 */
const STEPS: StepDef[] = [
  { key: "QUEUED", label: "排队" },
  { key: "PLANNING", label: "规划" },
  { key: "CODING", label: "编码" },
  { key: "RENDERING", label: "渲染" },
  { key: "COMPOSING", label: "合成" },
  { key: "VALIDATING", label: "校验" },
  { key: "COMPLETED", label: "完成" },
];

/** 主状态 → 已到达步骤下标（NARRATING 属于渲染后、合成前，按渲染计） */
const STATUS_INDEX: Record<string, number> = {
  QUEUED: 0,
  PLANNING: 1,
  CODING: 2,
  RENDERING: 3,
  NARRATING: 3,
  COMPOSING: 4,
  VALIDATING: 5,
  COMPLETED: 6,
};

/**
 * 状态步进条：QUEUED → PLANNING → CODING → RENDERING → COMPOSING → VALIDATING → COMPLETED。
 * 进行中步骤高亮；FAILED 追加红色「失败」标注；CANCELLED 追加「已取消」。
 */
export default function StatusStepper({ status }: { status: JobStatus }) {
  const reached = STATUS_INDEX[status] ?? 0;
  const failed = status === "FAILED";
  const cancelled = status === "CANCELLED";
  const completed = status === "COMPLETED";

  return (
    <ol className="flex w-full items-center">
      {STEPS.map((step, i) => {
        const done = completed || (!failed && !cancelled && i < reached);
        const active = !failed && !cancelled && i === reached;
        const isLast = i === STEPS.length - 1;
        const circleCls = done
          ? "border-accent bg-accent text-ink-950"
          : active
            ? "border-accent bg-accent/20 text-accent-soft"
            : "border-white/15 bg-white/[0.04] text-slate-600";
        const labelCls = done
          ? "text-slate-400"
          : active
            ? "text-accent-soft"
            : "text-slate-600";
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${circleCls}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[10px] leading-none ${labelCls}`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                className={`mx-1 mb-4 h-px min-w-2 flex-1 ${
                  done || active ? "bg-accent/60" : "bg-white/10"
                }`}
              />
            )}
          </li>
        );
      })}
      {failed && (
        <li className="ml-3 flex shrink-0 items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300">
          ✗ 失败
        </li>
      )}
      {cancelled && (
        <li className="ml-3 flex shrink-0 items-center rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400">
          已取消
        </li>
      )}
    </ol>
  );
}
