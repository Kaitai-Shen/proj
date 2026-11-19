import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GatewayError,
  listJobs,
  type JobDetail,
} from "../api/gatewayClient";
import ErrorCard from "../components/gateway/ErrorCard";
import ProgressBadge from "../components/gateway/ProgressBadge";
import SiteHeader from "../components/gateway/SiteHeader";

const PAGE_SIZE = 20;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("zh-CN", { hour12: false });
}

/** 任务历史：按创建时间倒序分页（每页 20，加载更多），点击行进详情 */
export default function HistoryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobDetail[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<GatewayError | null>(null);
  const [lastPageCount, setLastPageCount] = useState(0);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(async (offset: number): Promise<void> => {
    const isFirst = offset === 0;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await listJobs(PAGE_SIZE, offset);
      setJobs((prev) =>
        isFirst
          ? res.jobs
          : [
              ...prev,
              ...res.jobs.filter(
                (j) => !prev.some((p) => p.job_id === j.job_id),
              ),
            ],
      );
      offsetRef.current = offset + res.jobs.length;
      setTotal(res.total);
      setLastPageCount(res.jobs.length);
    } catch (err) {
      setError(
        err instanceof GatewayError
          ? err
          : new GatewayError("network", "生成服务未启动或不可达"),
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(0);
  }, [fetchPage]);

  const canLoadMore =
    error == null &&
    (total == null ? lastPageCount >= PAGE_SIZE : jobs.length < total);

  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-lg font-bold text-slate-100">
          任务历史
          {total != null && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {total} 条
            </span>
          )}
        </h1>

        {error && (
          <div className="mt-4">
            <ErrorCard
              kind={error.kind === "network" ? "network" : "http"}
              title="任务历史加载失败"
              message={error.message}
              detail={error.code ? `错误码 ${error.code}` : undefined}
              onRetry={() => void fetchPage(0)}
            />
          </div>
        )}

        {loading ? (
          <div className="mt-6 space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
              />
            ))}
          </div>
        ) : !error && jobs.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-ink-900/60 p-8 text-center">
            <div className="text-3xl">🎬</div>
            <p className="mt-3 text-sm text-slate-300">还没有生成任务</p>
            <p className="mt-1 text-xs text-slate-500">
              创建第一个教学视频，试试输入「介绍二分查找算法」。
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-accent-soft"
            >
              去创建任务 →
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-2">
              {jobs.map((job) => (
                <li key={job.job_id}>
                  <button
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-left transition hover:border-accent/50 hover:bg-accent/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-slate-200">
                        {job.topic}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-slate-600">
                        {job.job_id} · {formatTime(job.created_at)}
                      </div>
                    </div>
                    <ProgressBadge
                      status={job.status}
                      percent={job.progress_percent}
                      substatus={job.substatus}
                    />
                    <span className="shrink-0 text-slate-600">→</span>
                  </button>
                </li>
              ))}
            </ul>
            {canLoadMore && (
              <button
                onClick={() => void fetchPage(offsetRef.current)}
                disabled={loadingMore}
                className="mt-4 w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                {loadingMore ? "加载中…" : "加载更多"}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
