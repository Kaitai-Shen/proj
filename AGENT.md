# AGENT.md — 项目计划与 AI 代理工作约定

本文件面向在本仓库中工作的 AI 编码代理（Qoder、Claude Code 等），记录项目定位、架构决策与工作约定。

## 仓库概况

- 项目：**AI Tutor Video**（参赛站点工作名 LectureCast）— 基于 Code2Video 论文（arXiv 2510.01174）的多智能体教学视频生成系统
- 蓝图：`AI_Tutor_Video_技术设计文档 (1).md` V2.0（2026-11-19 确定为开发基线，docs/ 有评估）
- 参赛：2026 Qoder 高校创造力大赛（天池 532536，StudyHack 赛道）
- 硬性截止：报名 + 作品帖 **2026-11-30 18:00**；作品须部署到 Qoder Sites 并公开访问
- 部署形态：**前端 = Qoder Sites（公开入口）；后端 = FastAPI + Docker Manim 渲染，部署于外部 Linux 服务器**（当前阶段本机 WSL2/Docker 开发，公网方案赛前确定）

## 架构基线（v2，2026-11-19 转向确认）

1. **前端**：React 18 + TS + Vite + Tailwind（沿用现有栈）。业务页面：创建任务 `/`、任务详情 `/jobs/:id`（可刷新直达）、历史 `/history`；react-router-dom。原 LectureCast 浏览器渲染工作室保留为 `/demo` 演示页（后端宕机时的降级兜底 + 评委免后端体验）。
2. **网关契约**：`VideoGenerationGateway` REST JSON（契约文件 `docs/gateway-api-contract.md`）。创建任务返回 202 + job_id；前端 2s 轮询任务状态。前端从 `VITE_VIDEO_API_BASE_URL` 读网关地址，不硬编码。
3. **后端**：FastAPI + Pydantic v2 + SQLite(SQLAlchemy) + 独立 worker 进程（MVP 不引 Redis/Celery）。状态机：QUEUED→PLANNING→CODING→RENDERING→NARRATING→COMPOSING→VALIDATING→COMPLETED / FAILED / CANCELLED；子状态含 REPAIRING_CODE。
4. **渲染**：Manim Community **0.19** 固定版本容器；非 root、`--network none`、CPU/内存/时长限额；渲染失败定向修复最多 2 次（共 3 次渲染）；产物版本化不覆盖。
5. **模型**：服务端托管 Key（团队承担费用）。LLM = **DeepSeek**（Planner/Coder）；VLM（Critic）与中文 TTS 为 P1/P2 阶段再选型。
6. **分期范围**：P0 = 无声 MP4 全链路（规划→编码→渲染→修复→合并）；P1 = TTS + 字幕 + 音画对齐 + 任务历史；P2 = VLM Critic 抽帧审查。初始仅支持 15–90 秒数学/算法/结构化动画。
7. **安全**：AI 生成的 Python 绝不在 API/worker 主进程执行，只在受限渲染容器内；密钥仅存服务端 `.env`（不入 Git）；容器无网络、非 root、资源限额；公网开放前补认证与限流。

## 技术栈

- 前端：Vite + React 18 + TypeScript + Tailwind + react-router-dom；播放用原生 HTML5 video
- 后端：Python 3.11（容器内固定版本；本机 3.13 兼容运行）、FastAPI、Uvicorn、SQLAlchemy、openai SDK（DeepSeek 兼容协议）、pytest
- 渲染容器：manim 0.19 + LaTeX + FFmpeg；宿主机 FFmpeg 9.0.1 已就绪
- 部署：Docker Compose（renderer + backend）；本机 WSL2 Ubuntu 跑 Docker Engine（未装，安装前需确认）

## 目录结构

- `src/` 前端（现有壳 + 新增业务页面；`src/components/studio/` 为演示页）
- `backend/app/` FastAPI：`api/`(jobs,artifacts,health) `core/`(config,security,errors) `models/` `services/`(orchestrator,planner,coder,fixer,alignment,composer) `providers/` `tools/`(manim_runner,ffmpeg_runner,storage) `workers/`
- `renderer/` Dockerfile + entrypoint + policies
- `deploy/` compose.yaml + nginx.conf
- `docs/` 网关契约、部署清单、调研报告

## 工作约定

1. 提交信息英文或中文均可，简洁并说明「为什么」。
2. 修改代码前先读相关文件，避免重复造轮子。
3. 不随意引入新依赖；确需引入时在提交信息说明理由。
4. 未经确认不执行破坏性操作（force push、删除分支、重置工作区等）。
5. 保持 README 与实际结构同步。
6. **开发过程中及时 commit + push**（2026-11-19 用户明确要求，常态授权；破坏性操作仍需单独确认）。
7. 本地开发：前端 `npm run dev`（:5180）；后端 `uvicorn app.main:app`（:8000）；`npm run build` 产出静态站点。
8. 比赛材料（作品帖五部分、Qoder 开发过程截图）随开发随手留存，勿拖到最后。

## 里程碑（11 天压缩版，2026-11-19 起）

| 阶段 | 日期 | 内容 |
| --- | --- | --- |
| D1 | 11.19–20 | 契约定稿 + 后端骨架 + 前端三页面骨架 + renderer 镜像跑通固定示例 |
| D2–D3 | 11.21–22 | P0 无模型渲染链路 → 接 DeepSeek 单场景生成 + 代码修复 |
| D4–D5 | 11.23–24 | Planner 多场景 + 状态机/取消/进度 + 前端联调端到端 |
| D6–D7 | 11.25–26 | P1：TTS + 字幕 + 音画对齐 + 合成（视进度取舍） |
| D8–D9 | 11.27–28 | P2：VLM Critic 抽帧审查 + 打磨 + 冒烟测试集 |
| D10–D11 | 11.29–30 | 公网部署（服务器方案落地）+ 作品帖素材 |

已知风险：本机 Docker 未装（WSL2 方案待确认）；公网部署方案未定（本机开发 → 赛前需公网 HTTPS）；TTS 供应商未选型。
