import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LandingPage } from "./pages/LandingPage";
import { RunsPage } from "./pages/RunsPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { NewWorkflowPage } from "./pages/NewWorkflowPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<RunsPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="new" element={<NewWorkflowPage />} />
      </Route>
    </Routes>
  );
}
