import { Link } from "react-router-dom";
import { ArrowLeft, Film } from "../components/ui/Icons";

/** 404 轻量页 */
export default function NotFoundPage() {
  return (
    <div className="animate-enter flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-[96px] font-semibold leading-none text-oat">
        404
      </p>
      <p className="text-sm text-ink-muted">页面不存在或已被移动。</p>
      <div className="mt-3 flex gap-3">
        <Link to="/" className="btn-primary">
          <ArrowLeft size={15} /> 返回创建任务
        </Link>
        <Link to="/demo" className="btn-secondary">
          <Film size={15} /> 去演示模式
        </Link>
      </div>
    </div>
  );
}
