import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LoadingState } from "./components/Ui";
import { DashboardProvider, useDashboard } from "./state/DashboardContext";

const ConnectionPage = lazy(() => import("./pages/ConnectionPage").then((module) => ({ default: module.ConnectionPage })));
const OverviewPage = lazy(() => import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const PerformancePage = lazy(() => import("./pages/PerformancePage").then((module) => ({ default: module.PerformancePage })));
const ErrorsPage = lazy(() => import("./pages/ErrorsPage").then((module) => ({ default: module.ErrorsPage })));
const ErrorDetailPage = lazy(() => import("./pages/ErrorDetailPage").then((module) => ({ default: module.ErrorDetailPage })));
const EventsPage = lazy(() => import("./pages/EventsPage").then((module) => ({ default: module.EventsPage })));
const AlertsPage = lazy(() => import("./pages/AlertsPage").then((module) => ({ default: module.AlertsPage })));

export function App() {
  return (
    <DashboardProvider>
      <Suspense fallback={<LoadingState label="正在加载工作台…" />}>
        <Routes>
          <Route path="/connect" element={<ConnectionPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/errors" element={<ErrorsPage />} />
            <Route path="/errors/:fingerprint" element={<ErrorDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Suspense>
    </DashboardProvider>
  );
}

function ProtectedLayout() {
  const { connection } = useDashboard();
  return connection ? <AppLayout /> : <Navigate to="/connect" replace />;
}
