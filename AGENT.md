# AGENT.md — 项目计划与 AI 代理工作约定

本文件面向在本仓库中工作的 AI 编码代理（Qoder、Claude Code 等），记录项目定位、架构决策与工作约定。

## 仓库概况

- 项目：LectureCast（暂定名）— 基于 Code2Video 论文（arXiv 2510.01174）的教学视频生成 Web 应用
- 定位：用户输入知识点，三智能体（Planner/Coder/Critic）在浏览器端生成可播放的教学动画视频，看完可答题验证掌握
- 用途：参加 2026 Qoder 高校创造力大赛（天池 532536，StudyHack 赛道）
- 硬性截止：报名 + 作品帖 **2026-11-30 18:00**；作品须部署到 Qoder Sites 并公开访问
- 主语言：TypeScript（纯前端 SPA）

## 架构基线（已确认决策）

1. **纯前端 SPA**：Qoder Sites 部署静态产物；后端仅保留「可选 Edge Function 转发」一个能力。
2. **BYOK（自带 key）直连**：用户在前端填 API Key + Base URL（OpenAI 兼容协议），key 仅存 localStorage、界面明示「仅保存在本地浏览器」；供应商 CORS 拦截时自动降级走 Edge Function 转发（key 随请求透传，服务端不存储不落库）。
3. **Code-centric 渲染**：复刻 Code2Video 论文范式 — LLM 生成受约束的 Remotion（React 视频框架）组件代码，浏览器内 Sucrase 转译后在 Remotion `<Player>` 实时播放。「视频 = 可执行代码」。
4. **三智能体管线**（简化复刻论文）：
   - **Planner**：知识点 → 分镜脚本 JSON（每节标题 / 讲解词 / 动画意图）+ 教学小测验题
   - **Coder**：分镜 → Remotion 组件代码（流式直播打字效果）；仅允许使用内置组件库 API
   - **Critic**：Player 按帧截图 → VLM 审查布局/遮挡/文字溢出 → 生成修正补丁 → 循环
5. **无 key 演示模式**：预生成 3–5 个精品案例（分镜 + 代码 + 成品），一键回放完整智能体过程；评委无需 key 即可体验。
6. **TeachQuiz**：视频结束后小测验验证掌握程度（呼应论文端到端评测指标 TeachQuiz）。
7. **导出（stretch goal）**：逐帧截图 + WebCodecs/MediaRecorder 导出 WebM/MP4；未完成不阻塞主线。

## 技术栈

- 构建：Vite + React 18 + TypeScript；包管理 npm（Node ≥ 20）
- 样式：Tailwind CSS
- 视频渲染：`@remotion/player`（浏览器端）
- LLM 目标 API：自研受约束动画组件库（FormulaCard / StepList / AnimatedAxes 等，位于 `src/components/anim/`）
- 运行时转译：sucrase（浏览器内 JSX→JS）+ 受限作用域求值
- 公式：KaTeX；状态：zustand
- LLM 接入：OpenAI 兼容 `chat/completions` + SSE 流式

## 目录结构（规划）

- `src/components/studio/` 生成工作台 UI（管线可视化 / 播放器 / 代码编辑器联动）
- `src/components/anim/` 受约束动画组件库（LLM 生成代码的目标 API）
- `src/agents/` Planner / Coder / Critic 的 prompt 与编排逻辑
- `src/llm/` BYOK 客户端、流式解析、CORS 降级转发
- `src/sandbox/` Sucrase 转译 + 受限求值 + 错误捕获
- `src/examples/` 预生成演示案例
- `functions/` 可选 Edge Function 转发（Qoder Sites）

## 工作约定

1. 提交信息英文或中文均可，简洁并说明「为什么」。
2. 修改代码前先读相关文件，避免重复造轮子。
3. 不随意引入新依赖；确需引入时在提交信息说明理由。
4. 未经确认不执行破坏性操作（force push、删除分支、重置工作区等）。
5. 保持 README 与实际结构同步。
6. 本地开发：`npm install` → `npm run dev`；`npm run build` 产出静态站点。
7. 比赛材料（作品帖五部分、Qoder 开发过程截图）随开发随手留存，勿拖到最后。

## 里程碑

| 阶段 | 日期 | 内容 |
| --- | --- | --- |
| M1 | 11.19–20 | 脚手架 + 动画组件库 API + LLM 接入层 |
| M2 | 11.21–24 | Planner→Coder→播放器，单知识点全流程跑通 |
| M3 | 11.25–26 | Critic 截帧修正 + TeachQuiz + 演示模式 |
| M4 | 11.27–28 | UI 打磨 + 案例画廊 |
| M5 | 11.29–30 | Qoder Sites 部署 + 论坛作品帖 |
