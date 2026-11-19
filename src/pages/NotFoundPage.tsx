import { Link } from "react-router-dom";

/** 404 轻量页 */
export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl font-bold text-slate-700">404</div>
      <p className="text-sm text-slate-400">页面不存在或已被移动。</p>
      <div className="mt-2 flex gap-3">
        <Link
          to="/"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-soft"
        >
          返回创建任务
        </Link>
        <Link
          to="/demo"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          去演示模式
        </Link>
      </div>
    </div>
  );
}
