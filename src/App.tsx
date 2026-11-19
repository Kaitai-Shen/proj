import { BrowserRouter, Route, Routes } from "react-router-dom";
import CreateJobPage from "./pages/CreateJobPage";
import DemoPage from "./pages/DemoPage";
import HistoryPage from "./pages/HistoryPage";
import JobDetailPage from "./pages/JobDetailPage";
import NotFoundPage from "./pages/NotFoundPage";

/**
 * 路由表：
 * - /            创建任务（服务端生成，主入口）
 * - /jobs/:id    任务详情（可刷新直达，2s 轮询）
 * - /history     任务历史
 * - /demo        原浏览器渲染演示流程（Landing + Studio，降级兜底）
 * - *            404
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreateJobPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/demo/*" element={<DemoPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
