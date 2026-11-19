import { ANIM_API_DOC } from "./anim-api-doc";
import type { Storyboard } from "../types";

export function plannerPrompt(topic: string, audience: string): string {
  return `你是 LectureCast 的 Planner 智能体，负责把一个知识点设计成教学动画的分镜脚本。

主题：${topic}
受众：${audience}

请只输出一个 JSON 对象（不要 markdown 代码块、不要解释文字），结构如下：
{
  "topic": "主题名",
  "audience": "受众描述",
  "sections": [
    {
      "id": "s1",
      "title": "节标题（8-16字）",
      "subtitle": "可选副标题",
      "narration": "本节讲解词，口语化中文，1-2 句，60 字以内",
      "visual": "本节画面意图，必须明确使用哪个组件与参数要点，可选组件：FormulaCard（LaTeX 公式）、StepList（步骤列表）、AnimatedAxes+PlotCurve（函数图像）、FigureCard（概念卡片）、TableCompare（对比表格）、LabeledArrow/PlotPoint（标注）。描述要具体到内容本身。",
      "frames": 300
    }
  ],
  "quiz": [
    { "question": "单选题干", "options": ["A", "B", "C", "D"], "answerIndex": 0, "explanation": "解析" }
  ]
}

要求：
1. sections 为 4-6 节，教学逻辑完整：引入/直觉 → 核心定义或公式 → 具体例子或图像演示 → 常见误区或总结。
2. 所有 frames 总和在 900-1500 之间（30fps），单节 240-420。
3. quiz 恰好 3 题，考察视频讲到的核心理解，answerIndex 为正确选项下标。
4. visual 字段要具体（如"用 AnimatedAxes+PlotCurve 画 y=sin(x)，用 amber 色，叠加它的泰勒近似"），Coder 会照此写代码。`;
}

export function coderPrompt(storyboard: Storyboard): string {
  return `${ANIM_API_DOC}

---

# 任务

根据以下分镜脚本，写出一个完整的教学动画组件文件。

分镜脚本（JSON）：
${JSON.stringify(storyboard, null, 2)}

要求：
1. 输出完整代码文件，默认导出根组件；不要 markdown 代码块标记，不要任何解释文字。
2. 每个分镜节对应一个 <Sequence from={...} durationInFrames={节.frames}> + <Scene>，from 按顺序累加，帧数严格使用分镜给出的 frames。
3. 每节实现 visual 字段的画面意图，并放入 <CaptionBar text={该节 narration}>。
4. 时序设计：节内动画错落有致（用 delay 参数错开元素出场），不要所有元素同帧出现。
5. 严格只用 API 文档中的组件与 Remotion 原语，LaTeX 用 String.raw 保持反斜杠。`;
}

export function repairPrompt(code: string, compileError: string): string {
  return `${ANIM_API_DOC}

---

你之前生成的教学动画代码在浏览器编译/运行时报错了。请输出修正后的完整代码文件（默认导出根组件，不要 markdown 代码块标记，不要解释文字），只做必要的最小修改。

错误信息：
${compileError}

原代码：
${code}`;
}

export function criticFixPrompt(
  code: string,
  issues: Array<{ sectionId: string; severity: string; description: string; suggestion: string }>,
): string {
  return `以下是 LectureCast 生成的教学动画代码，Critic 审查发现了若干视觉问题。请输出修正后的完整代码文件（默认导出根组件，不要 markdown 代码块标记，不要解释文字），只做必要的最小修改。

发现的问题：
${JSON.stringify(issues, null, 2)}

原代码：
${code}`;
}

/** 供 chatOnce 使用的消息组装：文字 + 截图 */
export function buildCriticMessages(
  storyboard: Storyboard,
  frameShots: Array<{ sectionId: string; frame: number; dataUrl: string }>,
): import("../types").ChatMessage[] {
  const shotText = frameShots
    .map((s, i) => `截图 ${i + 1}：分镜节 ${s.sectionId}（帧 ${s.frame}）`)
    .join("\n");

  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `你是 LectureCast 的 Critic 智能体，审查 AI 生成教学视频的视觉质量。

分镜脚本：
${JSON.stringify(
  storyboard.sections.map((s) => ({ id: s.id, title: s.title, visual: s.visual })),
  null,
  2,
)}

以下是视频若干帧截图：
${shotText}

请逐帧检查：元素重叠/遮挡、文字或公式溢出画面、标题与内容重叠、坐标轴标签缺失或错位、字幕与内容冲突、配色对比度不足。
只输出 JSON（不要 markdown 代码块）：
{ "issues": [ { "sectionId": "s1", "severity": "high|medium|low", "description": "问题描述", "suggestion": "具体修正建议" } ] }
没有问题输出 { "issues": [] }。`,
        },
        ...frameShots.map(
          (s) =>
            ({
              type: "image_url",
              image_url: { url: s.dataUrl },
            }) as import("../types").ContentPart,
        ),
      ],
    },
  ];
}
