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
import {
  ArrowLeft,
  HelpCircle,
  LogoMark,
  Play,
  Settings,
  X,
} from "../ui/Icons";

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
    <div
      className="flex h-full flex-col gap-3"
      style={{ padding: "calc(12px * var(--site-space, 1))" }}
    >
      <header className="card-surface flex shrink-0 flex-wrap items-center gap-2.5 px-4 py-2.5">
        <button onClick={onHome} className="btn-ghost">
          <ArrowLeft size={14} /> 首页
        </button>
        <span className="flex items-center gap-2">
          <LogoMark size={24} />
          <span className="font-display hidden text-sm font-semibold tracking-tight text-ink sm:inline">
            LectureCast
          </span>
        </span>
        <span className="pill hidden xl:inline-flex">三智能体教学视频生成</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="输入知识点，如：傅里叶级数、汉诺塔问题、贝叶斯定理…"
          className="field-input h-9 min-w-[120px] flex-1 py-1.5 text-sm"
        />
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="field-input h-9 w-auto py-1.5 text-xs"
        >
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={autoCritic}
            onChange={(e) => setAutoCritic(e.target.checked)}
            style={{ accentColor: "var(--site-accent)" }}
          />
          Critic 修正
        </label>
        {running ? (
          <button onClick={() => abortPipeline()} className="btn-danger h-9">
            中止
          </button>
        ) : (
          <button onClick={generate} className="btn-primary h-9 px-4 py-1.5">
            <Play size={14} />
            生成教学视频
          </button>
        )}
        <button
          onClick={() => setTutorialOpen(true)}
          className="btn-secondary h-9 px-3 py-1.5 text-xs"
          title="新手教程"
        >
          <HelpCircle size={14} />
          教程
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="btn-secondary h-9 px-3 py-1.5 text-xs"
          title="配置模型 API"
        >
          <Settings size={14} />
          <span className="max-w-[96px] truncate">
            {llm.model || "未配置模型"}
          </span>
        </button>
      </header>

      {error ? (
        <div className="tone-danger shrink-0 rounded-btn border px-4 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px] xl:overflow-hidden">
        <AgentPane />
        <PlayerPane bridgeRef={bridgeRef} />
        <CodePane />
      </main>

      {settingsOpen ? (
        <div className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/45 p-4 backdrop-blur-sm">
          <div className="animate-modal w-full max-w-lg">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Settings size={15} /> 模型设置
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="btn-ghost rounded-full p-2"
                aria-label="关闭设置"
              >
                <X size={17} />
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
