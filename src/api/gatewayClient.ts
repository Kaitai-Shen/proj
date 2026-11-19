/**
 * VideoGenerationGateway API 客户端。
 * 契约唯一来源：docs/gateway-api-contract.md v1.0（改动须同步前后端并升版本号）。
 */

/** 主状态枚举（契约 §1，原样传输） */
export type JobStatus =
  | "QUEUED"
  | "PLANNING"
  | "CODING"
  | "RENDERING"
  | "NARRATING"
  | "COMPOSING"
  | "VALIDATING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** 子状态枚举（附属于主状态） */
export type JobSubstatus = "REPAIRING_CODE";

/** 产物类型枚举（契约 §3；P0 仅前四种 + render_log） */
export type ArtifactKind =
  | "lesson_plan"
  | "scene_code"
  | "scene_video"
  | "final_video"
  | "render_log"
  | "subtitles_srt"
  | "subtitles_vtt"
  | "narration_audio";

export type Audience = "beginner" | "intermediate";

/** 统一错误体（契约 §0） */
export interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface JobError {
  code: string;
  message: string;
}

export interface Artifact {
  artifact_id: string;
  kind: ArtifactKind;
  scene_id?: string;
  mime_type: string;
  size_bytes: number;
}

export interface JobDetail {
  request_id: string;
  job_id: string;
  topic: string;
  status: JobStatus;
  substatus: JobSubstatus | string | null;
  progress_percent: number;
  current_scene: number | null;
  scene_count: number | null;
  error: JobError | null;
  created_at: string;
  updated_at: string;
  artifacts: Artifact[];
}

export interface CreateJobRequest {
  topic: string;
  audience: Audience;
  /** P0 固定 zh-CN */
  language: "zh-CN";
  duration_seconds: number;
}

export interface CreateJobResponse {
  request_id: string;
  job_id: string;
  status: JobStatus;
  status_url: string;
}

export interface CancelJobResponse {
  status: JobStatus | string;
}

/** LessonPlan / SceneSpec（契约 §5，Planner 输出，存 storyboard） */
export interface SceneSpec {
  scene_id: string;
  order: number;
  concept: string;
  narration: string;
  visual_instructions: string;
  estimated_seconds: number;
  required_objects?: string[];
}

export interface LessonPlan {
  title: string;
  language: string;
  target_seconds: number;
  audience: string;
  learning_objectives: string[];
  scenes: SceneSpec[];
}

export interface JobListResult {
  jobs: JobDetail[];
  /** 后端若返回 total 则有值，否则 null（用「最后一页是否满页」判断能否继续加载） */
  total: number | null;
}

export type GatewayErrorKind = "network" | "http";

/**
 * 客户端错误。kind = "network" 表示网关不可达（fetch 层失败）；
 * kind = "http" 表示后端返回非 2xx（含契约错误体 code/message）。
 * 网络错误绝不与任务自身 error 字段混用。
 */
export class GatewayError extends Error {
  readonly kind: GatewayErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    kind: GatewayErrorKind,
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "GatewayError";
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

/** 网关地址：env 优先；未配置时开发回退 localhost:8000，生产回退同源。 */
const envBase = import.meta.env.VITE_VIDEO_API_BASE_URL;
export const API_BASE: string =
  (envBase && envBase.trim()) ||
  (import.meta.env.DEV ? "http://localhost:8000" : "");

const API_PREFIX = `${API_BASE.replace(/\/+$/, "")}/api/v1`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, init);
  } catch {
    throw new GatewayError("network", "生成服务未启动或不可达");
  }

  if (!res.ok) {
    const fallbackCode = `HTTP_${res.status}`;
    let code = fallbackCode;
    let message = `请求失败（HTTP ${res.status}）`;
    let details: unknown;
    const body: unknown = await res.json().catch(() => null);
    if (isRecord(body)) {
      if (typeof body.code === "string" && typeof body.message === "string") {
        // 契约统一错误体 { code, message, details }
        code = body.code;
        message = body.message;
        details = body.details;
      } else if (body.detail !== undefined) {
        // FastAPI 风格校验错误（422 detail 数组）
        const d = body.detail;
        if (typeof d === "string") {
          message = d;
        } else if (Array.isArray(d) && isRecord(d[0]) && typeof d[0].msg === "string") {
          message = String(d[0].msg);
        } else {
          try {
            message = JSON.stringify(d);
          } catch {
            message = fallbackCode;
          }
        }
        if (res.status === 422) code = "INVALID_INPUT";
      }
    }
    throw new GatewayError("http", message, { status: res.status, code, details });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** 创建生成任务（契约 §2，HTTP 202；非法输入 422 INVALID_INPUT 不入队） */
export function createJob(req: CreateJobRequest): Promise<CreateJobResponse> {
  return request<CreateJobResponse>("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

/** 任务详情（契约 §3，前端 2s 轮询） */
export function getJob(jobId: string): Promise<JobDetail> {
  return request<JobDetail>(`/jobs/${encodeURIComponent(jobId)}`);
}

/** 任务历史（按创建时间倒序分页；兼容裸数组与 { jobs, total } 两种返回） */
export async function listJobs(limit = 20, offset = 0): Promise<JobListResult> {
  const data = await request<unknown>(`/jobs?limit=${limit}&offset=${offset}`);
  return normalizeJobList(data);
}

/** LessonPlan 分镜（未生成时 404 NOT_READY） */
export function getStoryboard(jobId: string): Promise<LessonPlan> {
  return request<LessonPlan>(`/jobs/${encodeURIComponent(jobId)}/storyboard`);
}

/** 取消任务（202 {status}；不可取消时 409） */
export function cancelJob(jobId: string): Promise<CancelJobResponse> {
  return request<CancelJobResponse>(`/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
  });
}

/** 产物直链：视频可直接作为 <video src>，其余可直接下载（支持 Range） */
export function artifactUrl(jobId: string, artifactId: string): string {
  return `${API_PREFIX}/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}`;
}

function normalizeJobList(data: unknown): JobListResult {
  let items: unknown[] = [];
  let total: number | null = null;
  if (Array.isArray(data)) {
    items = data;
  } else if (isRecord(data) && Array.isArray(data.jobs)) {
    items = data.jobs;
    if (typeof data.total === "number") total = data.total;
  }
  return {
    jobs: items.filter(isRecord) as unknown as JobDetail[],
    total,
  };
}
