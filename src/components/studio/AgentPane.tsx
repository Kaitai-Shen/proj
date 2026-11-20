import { useEffect, useRef } from "react";
import { useStudio, type AgentName } from "../../store/studio";
import type { AgentPhase } from "../../types";
import { Code, Eye, Sparkles } from "../ui/Icons";

const AGENTS: Array<{
  name: AgentName;
  label: string;
  icon: typeof Sparkles;
  desc: string;
}> = [
  { name: "planner", label: "Planner 分镜师", icon: Sparkles, desc: "把知识点拆成教学分镜" },
  { name: "coder", label: "Coder 动画工程师", icon: Code, desc: "把分镜写成可执行动画代码" },
  { name: "critic", label: "Critic 视觉审查", icon: Eye, desc: "截帧审查布局并自动修正" },
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
  pending: "border-line bg-card text-ink-muted",
  active: "tone-running",
  done: "tone-success",
  error: "tone-danger",
};

const DOT: Record<string, string> = {
  pending: "bg-ink-faint",
  active: "bg-clay animate-breath",
  done: "bg-success",
  error: "bg-danger",
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
      <div className="card-surface p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="eyebrow">智能体流水线</h2>
          {phaseDetail && phase !== "idle" ? (
            <span className="text-[10px] text-ink-faint">{phaseDetail}</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {AGENTS.map((a) => {
            const st = statusOf(phase, a.name);
            const Icon = a.icon;
            return (
              <div
                key={a.name}
                className={`flex items-center gap-3 rounded-card-sm border px-3 py-2 transition ${COLOR[st]}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current bg-transparent">
                  <Icon size={14} />
                </span>
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
        <div className="card-surface min-h-0 flex-1 overflow-auto p-3.5">
          <h2 className="eyebrow mb-2">
            分镜脚本 · {storyboard.sections.length} 节
          </h2>
          <div className="flex flex-col gap-2">
            {storyboard.sections.map((s, i) => (
              <div key={s.id} className="card-inset px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-ink">
                    {i + 1}. {s.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-faint">
                    {s.frames}帧
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-muted">
                  {s.visual}
                </p>
              </div>
            ))}
          </div>
          {storyboard.quiz.length > 0 ? (
            <p className="mt-3 text-[11px] text-ink-muted">
              Planner 已生成 {storyboard.quiz.length} 道课后测验题
            </p>
          ) : null}
        </div>
      ) : (
        <div className="card-surface flex min-h-0 flex-1 items-center justify-center p-3.5">
          <div className="text-center text-ink-faint">
            <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-line">
              <Sparkles size={15} />
            </span>
            <p className="text-xs">分镜脚本将在这里实时展示</p>
          </div>
        </div>
      )}

      <div
        ref={logRef}
        className="panel-dark h-32 shrink-0 overflow-auto rounded-card-sm border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className="text-ink-faint">运行日志…</p>
        ) : (
          logs.map((l, i) => (
            <p key={i} className="text-ink-soft">
              <span
                className={
                  l.agent === "system"
                    ? "text-warning"
                    : l.agent === "planner"
                      ? "text-clay-deep"
                      : l.agent === "coder"
                        ? "text-success"
                        : "text-danger"
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
