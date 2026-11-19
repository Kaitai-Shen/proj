export type LLMConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type StoryboardSection = {
  id: string;
  title: string;
  subtitle?: string;
  narration: string;
  visual: string;
  frames: number;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export type Storyboard = {
  topic: string;
  audience: string;
  sections: StoryboardSection[];
  quiz: QuizQuestion[];
};

export type AgentPhase =
  | "idle"
  | "planning"
  | "coding"
  | "critiquing"
  | "done"
  | "error";

export type CriticIssue = {
  sectionId: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion: string;
};
