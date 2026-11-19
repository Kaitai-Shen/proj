# AI Tutor Video — Backend (FastAPI Gateway)

实现 `docs/gateway-api-contract.md` v1.0 的服务端：接收主题 → Planner 生成 Manim 分镜 → Coder 逐场景生成代码 → 渲染 MP4 → FFmpeg 合并。

## 快速开始

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows Git Bash / PowerShell
# Linux/macOS: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

copy .env.example .env    # 按需修改；LLM_API_KEY 不配也能用 stub 渲染跑通链路

# 启动（在 backend/ 目录下）
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Linux/macOS: .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- 健康检查：`GET http://localhost:8000/api/v1/health/live` → `{"ok": true}`
- 就绪检查：`GET /api/v1/health/ready` → `{"ok": true, "renderer": "stub"}`
- API 文档：`http://localhost:8000/docs`

## .env 说明

`backend/.env` 由 python-dotenv 加载（优先级低于真实环境变量），全部键见 `.env.example`：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `HOST` / `PORT` | 127.0.0.1 / 8000 | uvicorn 监听 |
| `DATABASE_URL` | sqlite backend/data/app.db | SQLAlchemy 连接串 |
| `ARTIFACT_ROOT` | backend/data/artifacts | 产物根目录（契约 §6 布局） |
| `LLM_BASE_URL` | https://api.deepseek.com | OpenAI 兼容端点 |
| `LLM_API_KEY` | 空 | DeepSeek Key；为空时 Planner 阶段任务 FAILED + MODEL_UPSTREAM |
| `LLM_MODEL` | deepseek-chat | |
| `RENDERER_MODE` | stub | stub / local / docker |
| `RENDER_TIMEOUT_SECONDS` | 300 | 单次渲染超时 |
| `MAX_RENDER_RETRIES` | 2 | 渲染失败定向修复次数（共 3 次渲染） |
| `MAX_VIDEO_DURATION` | 90 | 视频时长上限（秒） |
| `MAX_JOB_SECONDS` | 3600 | 单任务总时限 |
| `WORKER_ENABLED` | true | 应用启动时拉起 worker 线程 |

## RENDERER_MODE 三种模式

- **stub**（默认，无 manim 也可端到端联调）：不执行 Manim 代码，用 `ffmpeg testsrc2` 按 `estimated_seconds` 生成 1920x1080@30fps 测试视频，日志注明 STUB。
- **local**：`python -m manim -ql source.py GeneratedScene`，独立临时工作目录 + 超时 + 产物 ffprobe 复核。需要 venv/本机装有 manim 0.19。
- **docker**：`docker run --network none --user 1000:1000 --memory 2g --cpus 2`，源码只读挂载、输出独立卷（镜像 `aitv/manim:0.19`，由 renderer/ 目录后续提供）。本机无 Docker 时报清晰错误。

三种模式渲染成功后都做 ffprobe 复核（视频流存在、时长>0、分辨率）；退出码 0 但产物无效视为失败，进入修复循环。

## 端点（契约 v1.0）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/jobs` | 202 创建任务；422 `INVALID_INPUT`（topic 5–500 字、audience 枚举、duration 15–90、language 固定 zh-CN） |
| GET | `/api/v1/jobs/{id}` | 任务详情（前端 2s 轮询），含 artifacts |
| GET | `/api/v1/jobs?limit=&offset=` | 历史分页（按创建时间倒序） |
| GET | `/api/v1/jobs/{id}/storyboard` | LessonPlan JSON；未生成 404 `NOT_READY` |
| GET | `/api/v1/jobs/{id}/artifacts/{artifact_id}` | 文件下载；视频支持 HTTP Range（206/416）；归属不符 404 |
| POST | `/api/v1/jobs/{id}/cancel` | 202（QUEUED 直接 CANCELLED；PLANNING 置标志，下一阶段边界生效）；其余状态 409 |
| GET | `/api/v1/health/live` / `ready` | 存活 / 就绪 |

状态机：`QUEUED→PLANNING→CODING→RENDERING→COMPOSING→VALIDATING→COMPLETED`（P0 跳过 NARRATING），终态 `FAILED`/`CANCELLED`，子状态 `REPAIRING_CODE`。progress 估算：PLANNING 10、CODING 25、RENDERING 25–75、COMPOSING 85、VALIDATING 95、COMPLETED 100。

补充约定：storyboard 按 §4 返回裸 LessonPlan（`request_id` 在 `X-Request-Id` 头中）；cancel 409 复用错误码 `INVALID_INPUT`；`NOT_FOUND` 为契约 §1 之外补充的 API 级错误码。

## 模块地图

```
app/
  main.py               组装 + CORS + request_id 中间件 + 统一错误体
  core/config.py        pydantic-settings 风格配置（python-dotenv）
  core/errors.py        错误码枚举 + ApiError（code/message/details/request_id）
  models/db.py          SQLAlchemy：jobs/scenes/artifacts/task_events/model_calls
  api/jobs.py           任务 CRUD + storyboard + cancel
  api/artifacts.py      产物下载（Range/防穿越/归属校验）
  api/health.py         存活/就绪
  services/planner.py   PLANNER_PROMPT_V1；§5 校验；失败重试 2 次喂回错误
  services/coder.py     CODER_PROMPT_V1；固定 GeneratedScene；剥围栏+静态安全护栏
  services/fixer.py     FIXER_PROMPT_V1；错误摘要+日志尾100行+源码+分镜定向修复
  services/composer.py  统一转码 1920x1080@30fps H.264 yuv420p 后 concat
  services/orchestrator.py  状态机/进度/task_events/取消轮询/时限
  providers/openai_compatible.py  DeepSeek（OpenAI SDK）封装
  tools/manim_runner.py  stub/local/docker 三模式渲染执行器
  tools/ffmpeg_runner.py ffprobe 校验（视频流/时长/分辨率）
  tools/storage.py      产物布局 + artifact 登记（版本化不覆盖）
  workers/local_worker.py  单 worker 线程轮询 QUEUED（2s）
tests/                  pytest 离线套件（mock LLM + stub 渲染）
scripts/smoke.py        真实 DeepSeek 端到端冒烟（需 LLM_API_KEY）
```

## 测试

```bash
cd backend
.venv/Scripts/python -m pytest -v
```

全部离线：LLM 通过 monkeypatch 替换（`tests/conftest.py`），渲染固定 stub。

## 冒烟（真实 API）

```bash
export LLM_API_KEY=sk-xxx        # 或写入 backend/.env
.venv/Scripts/python scripts/smoke.py
```

打印状态流转与产物清单；key 缺失时打印 SKIP。
