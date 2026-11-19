import { create } from "zustand";
import type {
  AgentPhase,
  CriticIssue,
  QuizQuestion,
  Storyboard,
} from "../types";

export type AgentName = "system" | "planner" | "coder" | "critic";

export type LogEntry = {
  agent: AgentName;
  text: string;
  at: number;
};

export type StudioState = {
  topic: string;
  audience: string;
  phase: AgentPhase;
  phaseDetail: string;
  storyboard: Storyboard | null;
  storyboardText: string;
  generatedCode: string;
  criticIssues: CriticIssue[];
  quiz: QuizQuestion[];
  logs: LogEntry[];
  error: string | null;
  revision: number;
  codeVersion: number;
  showQuiz: boolean;
  autoCritic: boolean;
  setTopic: (t: string) => void;
  setAudience: (a: string) => void;
  setPhase: (p: AgentPhase, detail?: string) => void;
  setAutoCritic: (v: boolean) => void;
  setShowQuiz: (v: boolean) => void;
  appendStoryboardText: (t: string) => void;
  appendCode: (t: string) => void;
  setStoryboard: (s: Storyboard | null) => void;
  setCriticIssues: (i: CriticIssue[]) => void;
  bumpCodeVersion: (revision: number) => void;
  log: (agent: AgentName, text: string) => void;
  setError: (e: string | null) => void;
  reset: () => void;
};

const initial = {
  topic: "",
  audience: "高中生",
  phase: "idle" as AgentPhase,
  phaseDetail: "",
  storyboard: null as Storyboard | null,
  storyboardText: "",
  generatedCode: "",
  criticIssues: [] as CriticIssue[],
  quiz: [] as QuizQuestion[],
  logs: [] as LogEntry[],
  error: null as string | null,
  revision: 0,
  codeVersion: 0,
  showQuiz: false,
  autoCritic: true,
};

export const useStudio = create<StudioState>((set) => ({
  ...initial,
  setTopic: (topic) => set({ topic }),
  setAudience: (audience) => set({ audience }),
  setPhase: (phase, phaseDetail = "") => set({ phase, phaseDetail }),
  setAutoCritic: (autoCritic) => set({ autoCritic }),
  setShowQuiz: (showQuiz) => set({ showQuiz }),
  appendStoryboardText: (t) =>
    set((s) => ({ storyboardText: s.storyboardText + t })),
  appendCode: (t) => set((st) => ({ generatedCode: st.generatedCode + t })),
  setStoryboard: (storyboard) =>
    set((st) => ({ storyboard, quiz: storyboard?.quiz ?? st.quiz })),
  setCriticIssues: (criticIssues) => set({ criticIssues }),
  bumpCodeVersion: (revision) =>
    set((st) => ({ codeVersion: st.codeVersion + 1, revision })),
  log: (agent, text) =>
    set((st) => ({ logs: [...st.logs.slice(-200), { agent, text, at: Date.now() }] })),
  setError: (error) => set({ error }),
  reset: () => set({ ...initial }),
}));

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__studio = useStudio;
}
