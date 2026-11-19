import { useEffect, useRef } from "react";
import { useStudio } from "../../store/studio";

const SEVERITY_STYLE: Record<string, string> = {
  high: "border-rose-500/50 bg-rose-500/10 text-rose-300",
  medium: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  low: "border-white/15 bg-white/[0.04] text-slate-400",
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export default function CodePane() {
  const generatedCode = useStudio((s) => s.generatedCode);
  const criticIssues = useStudio((s) => s.criticIssues);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [generatedCode]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-ink-950/80">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide text-slate-400">
            生成的动画代码
          </h2>
          <span className="text-[10px] text-slate-600">
            {generatedCode.length > 0 ? `${generatedCode.length} 字符` : "待生成"}
          </span>
        </div>
        <pre
          ref={preRef}
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-slate-400"
        >
          {generatedCode || "// Coder 智能体生成的 Remotion 代码将在这里逐字直播"}
        </pre>
      </div>

      <div className="max-h-48 shrink-0 overflow-auto rounded-xl border border-white/10 bg-ink-900/60 p-3">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
          Critic 审查结果
          {criticIssues.length > 0 ? (
            <span className="ml-2 text-rose-300">{criticIssues.length} 项</span>
          ) : null}
        </h2>
        {criticIssues.length === 0 ? (
          <p className="text-[11px] text-slate-600">尚未审查或未发现问题</p>
        ) : (
          <div className="flex flex-col gap-2">
            {criticIssues.map((iss, i) => (
              <div key={i} className={`rounded-lg border px-3 py-2 text-[11px] ${SEVERITY_STYLE[iss.severity] ?? SEVERITY_STYLE.low}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{iss.sectionId}</span>
                  <span>{SEVERITY_LABEL[iss.severity] ?? iss.severity}</span>
                </div>
                <p className="mt-1 opacity-90">{iss.description}</p>
                <p className="mt-0.5 opacity-70">→ {iss.suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
