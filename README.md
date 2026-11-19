# LectureCast

把任意知识点变成一支教学动画视频 —— 基于 Code2Video 论文（arXiv 2510.01174）代码中心范式的 Web 应用。

三个 AI 智能体协作：

- **Planner** 分镜师：把知识点拆成教学分镜脚本与课后测验题
- **Coder** 动画工程师：把分镜写成可执行的 Remotion 动画代码，在浏览器实时渲染
- **Critic** 视觉审查：截帧审查布局问题并驱动代码自动修正

视频 = 可执行代码，全程可解释、可编辑、可复现。

## 快速开始

```bash
npm install
npm run dev     # 本地开发
npm run build   # 产出静态站点（dist/）
```

生成功能需自备模型 API Key（OpenAI 兼容协议），在前端「模型设置」中填入，Key 仅保存在本地浏览器。支持 DeepSeek、通义千问、OpenAI、Moonshot、SiliconFlow、Gemini 兼容端、Ollama 等。供应商不允许浏览器直连时自动降级走 Edge Function 转发（`functions/`，部署于 Qoder Sites）。

首页提供无需 Key 的演示案例。

## 更多

架构决策、目录结构与工作约定见 [AGENT.md](./AGENT.md)。
