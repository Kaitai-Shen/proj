import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Landing from "../components/studio/Landing";
import Studio from "../components/studio/Studio";

/**
 * /demo 演示页：完整保留原有浏览器渲染演示流程（Landing ↔ Studio），
 * 组件内部跳转从 state 改为路由（/demo、/demo/studio），顶部提供返回业务入口。
 */
export default function DemoPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-ink-900/70 px-4 py-2">
        <Link
          to="/"
          className="rounded-lg px-2 py-1 text-xs text-accent-soft hover:bg-accent/10"
        >
          ← 返回生成服务
        </Link>
        <span className="text-[10px] text-slate-600">
          演示模式 · 浏览器内渲染（无需后端，评委免部署体验）
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
