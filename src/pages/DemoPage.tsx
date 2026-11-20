import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Landing from "../components/studio/Landing";
import Studio from "../components/studio/Studio";
import { ArrowLeft, Play } from "../components/ui/Icons";

/**
 * /demo 演示页：完整保留原有浏览器渲染演示流程（Landing ↔ Studio），
 * 组件内部跳转从 state 改为路由（/demo、/demo/studio），顶部提供返回业务入口。
 */
export default function DemoPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="header-glass flex shrink-0 items-center gap-3 border-b border-line px-5 py-2.5">
        <Link to="/" className="btn-ghost">
          <ArrowLeft size={14} /> 返回生成服务
        </Link>
        <span className="hidden text-[11px] text-ink-faint sm:inline">
          演示模式 · 浏览器内渲染 · 无需后端
        </span>
        <span className="pill ml-auto">
          <Play size={11} /> 评委免部署体验
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Routes>
          <Route
            index
            element={<Landing onStart={() => navigate("/demo/studio")} />}
          />
          <Route
            path="studio"
            element={<Studio onHome={() => navigate("/demo")} />}
          />
          <Route path="*" element={<Navigate to="/demo" replace />} />
        </Routes>
      </div>
    </div>
  );
}
