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
import WavePoster from "../components/ui/WavePoster";
import { ArrowRight, Clock, Layers } from "../components/ui/Icons";

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
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="animate-enter flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <Layers size={12} /> 我的创作
            </p>
            <h1 className="font-display mt-1.5 text-3xl font-semibold text-ink">
              任务历史
            </h1>
          </div>
          {total != null && (
            <span className="pb-1 text-xs text-ink-muted">共 {total} 条</span>
          )}
        </div>

        {error && (
          <div className="mt-5">
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
          <div className="mt-6 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-surface flex items-center gap-4 p-4">
                <div className="skeleton h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/5" />
                  <div className="skeleton h-2.5 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : !error && jobs.length === 0 ? (
          <div className="card-surface animate-enter mt-8 grid items-center gap-6 p-6 sm:grid-cols-[0.9fr_1.1fr]">
            <WavePoster caption="一支成片 · 41 秒" />
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                还没有生成任务
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                创建第一个教学视频，试试输入「介绍二分查找算法」。也可以先看一支成品，感受一下最终效果。
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to="/" className="btn-primary">
                  去创建任务 <ArrowRight size={15} />
                </Link>
                <Link to="/demo" className="btn-secondary">
                  看演示案例
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-2.5">
              {jobs.map((job, i) => (
                <li
                  key={job.job_id}
                  className="animate-enter"
                  style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
                >
                  <button
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="card-surface lift group flex w-full items-center gap-4 p-4 text-left hover:border-line-strong"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oat text-ink-soft">
                      <Clock size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {job.topic}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">
                        {job.job_id} · {formatTime(job.created_at)}
                      </div>
                    </div>
                    <ProgressBadge
                      status={job.status}
                      percent={job.progress_percent}
                      substatus={job.substatus}
                    />
                    <ArrowRight
                      size={15}
                      className="shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-clay-deep"
                    />
                  </button>
                </li>
              ))}
            </ul>
            {canLoadMore && (
              <button
                onClick={() => void fetchPage(offsetRef.current)}
                disabled={loadingMore}
                className="btn-secondary mt-4 w-full py-2.5"
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
