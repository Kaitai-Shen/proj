import type { ChatMessage } from "../types";
import { streamChat, chatOnce } from "../llm/client";
import type { LLMConfig } from "../types";
import {
  plannerPrompt,
  coderPrompt,
  repairPrompt,
  criticFixPrompt,
  buildCriticMessages,
} from "./prompts";
import type { CriticIssue, Storyboard } from "../types";
import { useStudio } from "../store/studio";

export type PlayerBridge = {
  seekTo: (frame: number) => Promise<void>;
  captureFrame: () => Promise<string>;
  totalFrames: () => number;
};

let abortCtrl: AbortController | null = null;

export function abortPipeline(): void {
  abortCtrl?.abort();
  abortCtrl = null;
}

export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("输出中未找到 JSON 对象");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error("JSON 不完整（输出被截断或格式错误）");
}

function parseStoryboard(raw: string): Storyboard {
  const obj = extractJson(raw) as Partial<Storyboard>;
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    throw new Error("分镜缺少 sections");
  }
  const sections = obj.sections.map((s, i) => ({
    id: s.id ?? `s${i + 1}`,
    title: String(s.title ?? `第 ${i + 1} 节`),
    subtitle: s.subtitle,
    narration: String(s.narration ?? ""),
    visual: String(s.visual ?? ""),
    frames: Math.max(90, Math.round(Number(s.frames) || 300)),
  }));
  const quiz = Array.isArray(obj.quiz) ? obj.quiz : [];
  return {
    topic: String(obj.topic ?? ""),
    audience: String(obj.audience ?? ""),
    sections,
    quiz,
  };
}

export function totalFrames(sb: Storyboard): number {
  return sb.sections.reduce((acc, s) => acc + s.frames, 0);
}

function stripFence(code: string): string {
  const m = code.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)```/);
  const body = m ? m[1] : code;
  return body.replace(/^\s*(?:\/\/|\/\*)[\s\S]*?(?:\*\/)\s*/g, "").trimStart().replace(/^\s*```.*$/gm, "").trim();
}

export async function runPipeline(
  config: LLMConfig,
  bridge: PlayerBridge | null,
): Promise<void> {
  const st = useStudio.getState();
  st.reset();
  abortCtrl = new AbortController();
  const signal = abortCtrl.signal;
  const store = useStudio;

  try {
    // ---------- Planner ----------
    store.getState().setPhase("planning", "正在设计分镜脚本");
    store.getState().log("planner", `开始规划「${st.topic}」（受众：${st.audience}）`);
    const sbText = await streamChat(
      config,
      [{ role: "user", content: plannerPrompt(st.topic, st.audience) }],
      { onDelta: (d) => store.getState().appendStoryboardText(d) },
      signal,
    );
    const storyboard = parseStoryboard(sbText);
    store.getState().setStoryboard(storyboard);
    store.getState().log(
      "planner",
      `分镜完成：${storyboard.sections.length} 节，共 ${totalFrames(storyboard)} 帧，测验 ${storyboard.quiz.length} 题`,
    );

    // ---------- Coder ----------
    store.getState().setPhase("coding", "正在逐节生成动画代码");
    const code0 = await streamChat(
      config,
      [{ role: "user", content: coderPrompt(storyboard) }],
      { onDelta: (d) => store.getState().appendCode(d) },
      signal,
    );
    let currentCode = stripFence(code0);

    const { compileLecture } = await import("../sandbox");
    const tryCompile = (code: string) => compileLecture(code);
    let compiled = tryCompile(currentCode);
    if (!compiled.ok) {
      store.getState().log("coder", `编译失败，自动修复中：${compiled.error.slice(0, 120)}`);
      const fixed = await chatOnce(
        config,
        [{ role: "user", content: repairPrompt(currentCode, compiled.error) }],
        signal,
      );
      currentCode = stripFence(fixed);
      store.getState().appendCode("\n\n// —— 自动修复后的完整代码 ——\n\n");
      store.getState().appendCode(currentCode);
      compiled = tryCompile(currentCode);
    }
    if (!compiled.ok) {
      throw new Error(`生成代码无法编译：${compiled.error}`);
    }
    store.getState().bumpCodeVersion(store.getState().revision);
    store.getState().log("coder", "代码编译通过，可在播放器预览");

    // ---------- Critic ----------
    if (store.getState().autoCritic && bridge) {
      store.getState().setPhase("critiquing", "正在截帧审查视觉质量");
      const sb = store.getState().storyboard!;
      let issues: CriticIssue[] = [];
      for (let round = 0; round < 2; round++) {
        const shots: Array<{ sectionId: string; frame: number; dataUrl: string }> = [];
        for (const sec of sb.sections) {
          const f = Math.min(
            Math.round(sec.frames * 0.55),
            sec.frames - 10,
          );
          const globalFrame = sb.sections
            .slice(0, sb.sections.indexOf(sec))
            .reduce((acc, s) => acc + s.frames, 0) + f;
          await bridge.seekTo(globalFrame);
          const dataUrl = await bridge.captureFrame();
          shots.push({ sectionId: sec.id, frame: globalFrame, dataUrl });
        }
        const msgs: ChatMessage[] = buildCriticMessages(sb, shots);
        const reviewRaw = await chatOnce(config, msgs, signal);
        const parsed = extractJson(reviewRaw) as { issues?: CriticIssue[] };
        issues = Array.isArray(parsed.issues) ? parsed.issues : [];
        store.getState().setCriticIssues(issues);
        store.getState().log("critic", `第 ${round + 1} 轮审查：发现 ${issues.length} 个问题`);

        const blocking = issues.filter((i) => i.severity === "high" || i.severity === "medium");
        if (blocking.length === 0) break;
        store.getState().setPhase("critiquing", `正在修复 ${blocking.length} 个视觉问题`);
        const fixed = await chatOnce(
          config,
          [{ role: "user", content: criticFixPrompt(currentCode, blocking) }],
          signal,
        );
        const nextCode = stripFence(fixed);
        const nextCompiled = tryCompile(nextCode);
        if (nextCompiled.ok) {
          currentCode = nextCode;
          store.getState().appendCode("\n\n// —— Critic 修正后的完整代码 ——\n\n");
          store.getState().appendCode(currentCode);
          store.getState().bumpCodeVersion(store.getState().revision + round + 1);
          store.getState().log("critic", "修正代码编译通过，已更新播放器");
        } else {
          store.getState().log("critic", "修正代码未通过编译，保留原版本");
          break;
        }
      }
    }

    store.getState().setPhase("done", "生成完成");
    if (store.getState().quiz.length > 0) {
      store.getState().setShowQuiz(true);
    }
  } catch (e) {
    if (signal.aborted) {
      store.getState().setPhase("idle", "已中止");
      store.getState().log("system", "用户中止了生成");
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    store.getState().setError(msg);
    store.getState().setPhase("error", "出错");
    store.getState().log("system", `失败：${msg}`);
  }
}
