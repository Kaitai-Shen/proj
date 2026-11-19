# VideoGenerationGateway API 契约 v1.0

定稿依据：AI_Tutor_Video 技术设计文档 §6。前端与后端唯一对接面；改动须同步双方并升版本号。

## 0. 总则

- Base URL：前端从 `VITE_VIDEO_API_BASE_URL` 读取（本机开发 `http://localhost:8000`），路径前缀 `/api/v1`。
- 所有 JSON 响应含 `request_id`；错误响应统一 `{ "code": string, "message": string, "details"?: object }`。
- P0 阶段无 TTS：状态机跳过 `NARRATING`（渲染后直接进入 `COMPOSING` 仅做 concat）。
- 身份：P0 单用户本地，无鉴权；字段 `owner_id` 预留。

## 1. 状态机

```
QUEUED → PLANNING → CODING → RENDERING → COMPOSING → VALIDATING → COMPLETED
任一业务阶段 → FAILED；QUEUED/PLANNING → CANCELLED（P0 限制取消窗口）
子状态（附属于主状态）：REPAIRING_CODE（渲染失败进入定向修复）
```

枚举值（前后端共用，原样传输）：
`QUEUED | PLANNING | CODING | RENDERING | NARRATING | COMPOSING | VALIDATING | COMPLETED | FAILED | CANCELLED`
子状态：`REPAIRING_CODE`

错误码：`INVALID_INPUT | FAILED_PLAN | FAILED_CODE | FAILED_RENDER | FAILED_COMPOSE | MODEL_UPSTREAM | INTERNAL`

## 2. 任务创建

`POST /api/v1/jobs` → **HTTP 202**

```json
// 请求
{
  "topic": "介绍二分查找算法",          // 5–500 字，必填
  "audience": "beginner",              // beginner | intermediate
  "language": "zh-CN",                 // P0 固定
  "duration_seconds": 45               // 15–90
}
// 响应
{
  "request_id": "req_...",
  "job_id": "job_01ABCD",
  "status": "QUEUED",
  "status_url": "/api/v1/jobs/job_01ABCD"
}
```

非法输入 → 422 + `INVALID_INPUT`，不入队。

## 3. 任务详情（前端 2s 轮询）

`GET /api/v1/jobs/{job_id}` → 200

```json
{
  "request_id": "req_...",
  "job_id": "job_01ABCD",
  "topic": "介绍二分查找算法",
  "status": "RENDERING",               // 主状态枚举
  "substatus": "REPAIRING_CODE",       // 可为 null
  "progress_percent": 62,              // 阶段估算，非精确
  "current_scene": 2,
  "scene_count": 4,
  "error": null,                        // {code, message} | null
  "created_at": "2026-11-19T12:00:00Z",
  "updated_at": "2026-11-19T12:03:21Z",
  "artifacts": [                        // 就绪即出现，非终态可为空数组
    { "artifact_id": "art_1", "kind": "lesson_plan", "mime_type": "application/json", "size_bytes": 1830 },
    { "artifact_id": "art_2", "kind": "scene_video", "scene_id": "scene_001", "mime_type": "video/mp4", "size_bytes": 402103 },
    { "artifact_id": "art_3", "kind": "final_video", "mime_type": "video/mp4", "size_bytes": 1234567 }
  ]
}
```

artifacts `kind` 枚举：`lesson_plan | scene_code | scene_video | final_video | render_log | subtitles_srt | subtitles_vtt | narration_audio`（P0 仅前四种 + render_log）。

## 4. 其余端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/jobs?limit=&offset=` | 任务历史（按创建时间倒序分页） |
| GET | `/api/v1/jobs/{id}/storyboard` | LessonPlan JSON（未生成时 404 `NOT_READY`） |
| GET | `/api/v1/jobs/{id}/artifacts/{artifact_id}` | 产物内容；视频类支持 HTTP Range 流式返回；归属校验失败 404 |
| POST | `/api/v1/jobs/{id}/cancel` | 202 `{status}`；不可取消时 409 |
| GET | `/api/v1/health/live` | `{ok: true}` |
| GET | `/api/v1/health/ready` | 含渲染器可用性 `{"renderer": "docker\|local\|stub"}` |

## 5. LessonPlan / SceneSpec 结构（Planner 输出，存 storyboard）

```json
{
  "title": "二分查找入门",
  "language": "zh-CN",
  "target_seconds": 45,
  "audience": "beginner",
  "learning_objectives": ["理解查找区间如何缩小"],
  "scenes": [
    {
      "scene_id": "scene_001",
      "order": 1,
      "concept": "有序数组与中点",
      "narration": "二分查找从有序数组的中间元素开始。",
      "visual_instructions": "展示数组与中间指针，突出中间元素",
      "estimated_seconds": 12,
      "required_objects": ["array", "mid_pointer"]
    }
  ]
}
```

校验规则（Planner 后端强制）：`scene_id` 唯一且格式 `scene_\d{3}`；`order` 连续；`estimated_seconds > 0` 且单场景 ≤ 30；总时长 ∈ [duration_seconds×0.6, duration_seconds×1.5]；scenes 数量 1–8。

## 6. 产物文件布局（服务端）

```
artifacts/jobs/{job_id}/
  request.json
  lesson_plan.json
  manifest.json
  scenes/scene_001/{source_v1.py, source_v2.py, render_v2.mp4, render.log}
  final.mp4
```

以 `job_id + scene_id + stage + version` 幂等定位；绝不覆盖旧版本源码。
