import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../api/gatewayClient";

/**
 * 统一错误卡。
 * kind = "network"：生成服务不可达 — 给出「到演示模式体验完整效果」的 /demo 出口；
 * kind = "http"：后端返回的业务/校验错误（422 INVALID_INPUT 等）。
 */
export default function ErrorCard({
  kind = "http",
  title,
  message,
  detail,
  onRetry,
  className,
}: {
  kind?: "network" | "http";
  title?: string;
  message?: ReactNode;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const isNetwork = kind === "network";
  const finalTitle =
    title ?? (isNetwork ? "生成服务未启动或不可达" : "请求失败");
  const defaultMessage: ReactNode = isNetwork
    ? `无法连接生成服务${API_BASE ? `（${API_BASE}）` : ""}，可先到演示模式体验完整效果。`
    : null;
  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm ${
        isNetwork
          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
          : "border-rose-500/40 bg-rose-500/10 text-rose-200"
      } ${className ?? ""}`}
    >
      <div className="font-medium">{finalTitle}</div>
      {message ?? defaultMessage ? (
        <div className="mt-1 text-xs leading-relaxed opacity-90">
          {message ?? defaultMessage}
        </div>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        {isNetwork && (
          <Link
            to="/demo"
            className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20"
          >
            🎬 先到演示模式体验完整效果 →
          </Link>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
          >
            重试
          </button>
        )}
        {detail && (
          <span className="font-mono text-[10px] opacity-70">{detail}</span>
        )}
      </div>
    </div>
  );
}
