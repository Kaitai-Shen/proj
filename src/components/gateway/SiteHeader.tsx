import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Clock, Film, LogoMark, Sparkles } from "../ui/Icons";

function NavItem({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        `flex items-center gap-1.5 rounded-btn px-2.5 py-1.5 transition sm:px-3 ${
          isActive
            ? "bg-oat text-ink"
            : "text-ink-muted hover-wash hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {icon}
          <span className="hidden sm:inline">{label}</span>
          {isActive ? (
            <span className="h-1 w-1 rounded-full bg-clay" />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

/** 业务页面共享顶栏：纸感吸顶，当前页以陶土圆点标记 */
export default function SiteHeader() {
  return (
    <header className="header-glass sticky top-0 z-40 border-b border-line">
      <div className="mx-auto flex w-full max-w-page items-center gap-3 px-5 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className="font-display text-[17px] font-semibold tracking-tight text-ink">
            AI Tutor Video
          </span>
        </Link>
        <span className="ml-1 hidden border-l border-line pl-3 text-[11px] tracking-wide text-ink-muted md:inline">
          把知识画成会动的视频
        </span>
        <nav className="ml-auto flex items-center gap-1 text-xs">
          <NavItem to="/" end icon={<Sparkles size={14} />} label="创建任务" />
          <NavItem to="/history" icon={<Clock size={14} />} label="任务历史" />
          <NavItem to="/demo" icon={<Film size={14} />} label="演示模式" />
        </nav>
      </div>
    </header>
  );
}
