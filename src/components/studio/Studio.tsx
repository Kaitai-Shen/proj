import { useRef, useState } from "react";
import AgentPane from "./AgentPane";
import PlayerPane from "./PlayerPane";
import CodePane from "./CodePane";
import QuizModal from "./QuizModal";
import SettingsPanel from "../../llm/SettingsPanel";
import TutorialModal from "./Tutorial";
import { useLLMSettings } from "../../llm/settings";
import { useStudio } from "../../store/studio";
import { runPipeline, abortPipeline } from "../../agents/pipeline";

const AUDIENCES = ["高中生", "大学生", "研究生", "工程师", "零基础"];

export default function Studio({ onHome }: { onHome: () => void }) {
  const bridgeRef = useRef<import("../../agents/pipeline").PlayerBridge | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const topic = useStudio((s) => s.topic);
  const audience = useStudio((s) => s.audience);
  const autoCritic = useStudio((s) => s.autoCritic);
  const phase = useStudio((s) => s.phase);
  const error = useStudio((s) => s.error);
  const setTopic = useStudio((s) => s.setTopic);
  const setAudience = useStudio((s) => s.setAudience);
  const setAutoCritic = useStudio((s) => s.setAutoCritic);
  const setError = useStudio((s) => s.setError);

  const llm = useLLMSettings();
  const running = phase === "planning" || phase === "coding" || phase === "critiquing";

  const generate = () => {
    if (!topic.trim()) {
      setError("请先输入知识点");
      return;
    }
    if (!llm.baseUrl || !llm.apiKey || !llm.model) {
      setError("请先配置模型 API（Key 仅保存在本地浏览器）");
      setSettingsOpen(true);
      return;
    }
    setError(null);
    void runPipeline(
      { baseUrl: llm.baseUrl, apiKey: llm.apiKey, model: llm.model },
      bridgeRef.current,
    );
  };

  return (
    <div className="flex h-full flex-col gap-3" style={{ padding: "calc(12px * var(--site-space, 1))" }}>
      <header className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-2.5">
        <button
          onClick={onHome}
          className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          ← 首页
        </button>
        <span className="text-sm font-bold tracking-wide text-slate-100">
          LectureCast
        </span>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent-soft">
          三智能体教学视频生成
        </span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="输入知识点，如：傅里叶级数、汉诺塔问题、贝叶斯定理…"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent/60 focus:outline-none"
        />
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="rounded-lg border border-white/15 bg-ink-800 px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
        >
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={autoCritic}
            onChange={(e) => setAutoCritic(e.target.checked)}
            className="accent-[#5b8cff]"
          />
          Critic 修正
        </label>
        {running ? (
          <button
            onClick={() => abortPipeline()}
            className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20"
          >
            中止
          </button>
        ) : (
          <button
            onClick={generate}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-ink-950 hover:bg-accent-soft"
          >
            生成教学视频
          </button>
        )}
        <button
          onClick={() => setTutorialOpen(true)}
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
          title="新手教程"
        >
          ❓ 教程
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
          title="配置模型 API"
        >
          ⚙ {llm.model || "未配置模型"}
        </button>
      </header>

      {error ? (
        <div className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <main
        className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_340px] gap-3"
        style={{ gap: "calc(12px * var(--site-space, 1))" }}
      >
        <AgentPane />
        <PlayerPane bridgeRef={bridgeRef} />
        <CodePane />
      </main>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-ink-800 p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">模型设置</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <SettingsPanel
              onShowTutorial={() => {
                setSettingsOpen(false);
                setTutorialOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      <QuizModal />
      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  );
}
