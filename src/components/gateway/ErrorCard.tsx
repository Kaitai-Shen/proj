import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../api/gatewayClient";
import { AlertTriangle, Film, Refresh } from "../ui/Icons";

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
      className={`animate-enter-fast flex gap-3 rounded-card-sm border p-4 ${
        isNetwork
          ? "tone-warning"
          : "tone-danger"
      } ${className ?? ""}`}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current">
        <AlertTriangle size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{finalTitle}</div>
        {message ?? defaultMessage ? (
          <div className="mt-1 text-xs leading-relaxed opacity-90">
            {message ?? defaultMessage}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isNetwork && (
            <Link
              to="/demo"
              className="btn-secondary border-current bg-transparent px-3 py-1.5 text-xs"
            >
              <Film size={13} />
              先到演示模式体验
            </Link>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-secondary border-current bg-transparent px-3 py-1.5 text-xs"
            >
              <Refresh size={13} />
              重试
            </button>
          )}
          {detail && (
            <span className="font-mono text-[10px] opacity-70">{detail}</span>
          )}
        </div>
      </div>
    </div>
  );
}
