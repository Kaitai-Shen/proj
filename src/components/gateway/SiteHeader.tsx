import { Link, NavLink } from "react-router-dom";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-2.5 py-1 transition ${
    isActive
      ? "bg-accent/15 text-accent-soft"
      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
  }`;

/** 业务页面共享顶栏：创建任务 / 任务历史 / 演示模式 */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wide text-slate-100">
            AI Tutor Video
          </span>
        </Link>
        <span className="hidden rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent-soft sm:inline">
          多智能体教学视频生成
        </span>
        <nav className="ml-auto flex items-center gap-1 text-xs">
          <NavLink to="/" end className={navCls}>
            创建任务
          </NavLink>
          <NavLink to="/history" className={navCls}>
            任务历史
          </NavLink>
          <NavLink to="/demo" className={navCls}>
            演示模式
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
