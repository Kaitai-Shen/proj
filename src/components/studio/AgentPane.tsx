import { useEffect, useRef } from "react";
import { useStudio, type AgentName } from "../../store/studio";
import type { AgentPhase } from "../../types";

const AGENTS: Array<{ name: AgentName; label: string; icon: string; desc: string }> = [
  { name: "planner", label: "Planner 分镜师", icon: "🧩", desc: "把知识点拆成教学分镜" },
  { name: "coder", label: "Coder 动画工程师", icon: "⌨️", desc: "把分镜写成可执行动画代码" },
  { name: "critic", label: "Critic 视觉审查", icon: "🔍", desc: "截帧审查布局并自动修正" },
];

function statusOf(phase: AgentPhase, name: AgentName): "pending" | "active" | "done" | "error" {
  if (phase === "error") return "error";
  if (phase === "done") return "done";
  const order: AgentPhase[] = ["idle", "planning", "coding", "critiquing", "done"];
  const idx = order.indexOf(phase);
  const own = order.indexOf(
    name === "planner" ? "planning" : name === "coder" ? "coding" : "critiquing",
  );
  if (idx === own) return "active";
  return idx > own ? "done" : "pending";
}

const COLOR: Record<string, string> = {
  pending: "border-white/10 bg-white/[0.02] text-slate-500",
  active: "border-accent/60 bg-accent/10 text-slate-200 shadow-[0_0_18px_rgba(91,140,255,0.25)]",
  done: "border-emerald-500/40 bg-emerald-500/[0.06] text-slate-300",
  error: "border-rose-500/50 bg-rose-500/10 text-rose-300",
};

const DOT: Record<string, string> = {
  pending: "bg-slate-600",
  active: "bg-accent animate-pulse",
  done: "bg-emerald-400",
  error: "bg-rose-400",
};

export default function AgentPane() {
  const phase = useStudio((s) => s.phase);
  const phaseDetail = useStudio((s) => s.phaseDetail);
  const storyboard = useStudio((s) => s.storyboard);
  const logs = useStudio((s) => s.logs);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-400">智能体流水线</h2>
          {phaseDetail && phase !== "idle" ? (
            <span className="text-[10px] text-slate-500">{phaseDetail}</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {AGENTS.map((a) => {
            const st = statusOf(phase, a.name);
            return (
              <div key={a.name} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${COLOR[st]}`}>
                <span className="text-lg">{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.label}</div>
                  <div className="truncate text-[11px] opacity-70">{a.desc}</div>
                </div>
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[st]}`} />
              </div>
            );
          })}
        </div>
      </div>

      {storyboard ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-ink-900/60 p-3">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
            分镜脚本 · {storyboard.sections.length} 节
          </h2>
          <div className="flex flex-col gap-2">
            {storyboard.sections.map((s, i) => (
              <div key={s.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-slate-200">
                    {i + 1}. {s.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">{s.frames}帧</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                  {s.visual}
                </p>
              </div>
            ))}
          </div>
          {storyboard.quiz.length > 0 ? (
            <p className="mt-3 text-[11px] text-slate-500">
              📝 Planner 已生成 {storyboard.quiz.length} 道课后测验题
            </p>
          ) : null}
        </div>
      ) : (
        <div className="min-h-0 flex-1 rounded-xl border border-white/10 bg-ink-900/60 p-3 text-xs text-slate-600">
          分镜脚本将在这里实时展示
        </div>
      )}

      <div
        ref={logRef}
        className="h-32 shrink-0 overflow-auto rounded-xl border border-white/10 bg-ink-950/80 p-3 font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className="text-slate-600">运行日志…</p>
        ) : (
          logs.map((l, i) => (
            <p key={i} className="text-slate-400">
              <span
                className={
                  l.agent === "system"
                    ? "text-amber-400"
                    : l.agent === "planner"
                      ? "text-accent-soft"
                      : l.agent === "coder"
                        ? "text-emerald-400"
                        : "text-rose-300"
                }
              >
                [{l.agent}]
              </span>{" "}
              {l.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
