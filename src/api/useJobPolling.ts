import { useCallback, useEffect, useRef, useState } from "react";
import {
  GatewayError,
  getJob,
  type JobDetail,
  type JobStatus,
} from "./gatewayClient";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES: readonly JobStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export interface JobPollingState {
  /** 最新任务详情；首次加载完成前为 null */
  job: JobDetail | null;
  /**
   * 刷新错误（网络不可达 / 服务 5xx 等），与任务自身的 error 字段严格区分：
   * 网络错误不写入 job.error，也不清空最后一次成功获取的任务数据。
   */
  refreshError: GatewayError | null;
  /** 首次加载尚未完成 */
  loading: boolean;
  /** 任务不存在（404），轮询已停止 */
  notFound: boolean;
  /** 手动立即刷新一次（不清空现有数据） */
  refresh: () => void;
}

/**
 * 2s 轮询任务详情：
 * - 终态（COMPLETED / FAILED / CANCELLED）自动停止；
 * - 组件卸载 / jobId 变化停止并清理定时器；
 * - 404 → notFound=true 并停止轮询；
 * - 网络错误只写入 refreshError 并继续重试（保留最后一次成功数据）。
 */
export function useJobPolling(jobId: string | undefined): JobPollingState {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [refreshError, setRefreshError] = useState<GatewayError | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<number | null>(null);

  // jobId 变化（或重新挂载）时重置状态；tick 触发的刷新保留现有数据
  useEffect(() => {
    setJob(null);
    setRefreshError(null);
    setNotFound(false);
    setLoading(true);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    let alive = true;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const poll = async (): Promise<void> => {
      try {
        const detail = await getJob(jobId);
        if (!alive) return;
        setJob(detail);
        setRefreshError(null);
        setNotFound(false);
        if (!TERMINAL_STATUSES.includes(detail.status)) {
          timerRef.current = window.setTimeout(
            () => void poll(),
            POLL_INTERVAL_MS,
          );
        }
      } catch (err) {
        if (!alive) return;
        const ge =
          err instanceof GatewayError
            ? err
            : new GatewayError("network", "生成服务未启动或不可达");
        if (ge.kind === "http" && ge.status === 404) {
          // 任务不存在：停止轮询，由页面渲染「任务不存在」
          setNotFound(true);
          return;
        }
        setRefreshError(ge);
        timerRef.current = window.setTimeout(
          () => void poll(),
          POLL_INTERVAL_MS,
        );
      } finally {
        if (alive) setLoading(false);
      }
    };

    void poll();
    return () => {
      alive = false;
      clearTimer();
    };
  }, [jobId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { job, refreshError, loading, notFound, refresh };
}
