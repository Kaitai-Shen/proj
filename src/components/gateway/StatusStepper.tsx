import type { JobStatus } from "../../api/gatewayClient";
import { Check, XCircle } from "../ui/Icons";

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
 * 进行中步骤以呼吸圆点示意；FAILED / CANCELLED 追加尾部标注。
 */
export default function StatusStepper({ status }: { status: JobStatus }) {
  const reached = STATUS_INDEX[status] ?? 0;
  const failed = status === "FAILED";
  const cancelled = status === "CANCELLED";
  const completed = status === "COMPLETED";

  return (
    <ol className="flex w-full items-start">
      {STEPS.map((step, i) => {
        const done = completed || (!failed && !cancelled && i < reached);
        const active = !failed && !cancelled && i === reached;
        const isLast = i === STEPS.length - 1;
        const circleCls = done
          ? "border-clay bg-clay text-clay-on"
          : active
            ? "border-clay bg-card"
            : "border-line bg-card text-ink-faint";
        const labelCls = done
          ? "text-ink-soft"
          : active
            ? "font-medium text-clay-deep"
            : "text-ink-faint";
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-start">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition ${circleCls}`}
              >
                {done ? (
                  <Check size={13} />
                ) : active ? (
                  <span className="animate-breath h-2 w-2 rounded-full bg-clay" />
                ) : (
                  i + 1
                )}
              </span>
              <span className={`whitespace-nowrap text-[11px] leading-none ${labelCls}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                className={`mx-1.5 mt-3.5 h-px min-w-2 flex-1 ${
                  done ? "bg-clay" : "bg-line"
                }`}
              />
            )}
          </li>
        );
      })}
      {failed && (
        <li className="tone-danger ml-3 flex shrink-0 items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-medium">
          <XCircle size={13} /> 失败
        </li>
      )}
      {cancelled && (
        <li className="tone-neutral ml-3 flex shrink-0 items-center rounded-pill border px-2.5 py-1 text-xs font-medium">
          已取消
        </li>
      )}
    </ol>
  );
}
