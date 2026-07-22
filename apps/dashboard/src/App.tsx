import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ConnectionSkeleton, HomeLoadingState, PageSkeleton } from "./components/Loading";
import { DashboardProvider, useDashboard } from "./state/DashboardContext";

const ConnectionPage = lazy(() => import("./pages/ConnectionPage").then((module) => ({ default: module.ConnectionPage })));
const OverviewPage = lazy(() => import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const PerformancePage = lazy(() => import("./pages/PerformancePage").then((module) => ({ default: module.PerformancePage })));
const ErrorsPage = lazy(() => import("./pages/ErrorsPage").then((module) => ({ default: module.ErrorsPage })));
const ErrorDetailPage = lazy(() => import("./pages/ErrorDetailPage").then((module) => ({ default: module.ErrorDetailPage })));
const EventsPage = lazy(() => import("./pages/EventsPage").then((module) => ({ default: module.EventsPage })));
const AlertsPage = lazy(() => import("./pages/AlertsPage").then((module) => ({ default: module.AlertsPage })));
const SourceMapsPage = lazy(() => import("./pages/SourceMapsPage").then((module) => ({ default: module.SourceMapsPage })));

export function App() {
  return (
    <DashboardProvider>
      <Routes>
          <Route path="/connect" element={<Suspense fallback={<ConnectionSkeleton />}><ConnectionPage /></Suspense>} />
          <Route element={<ProtectedLayout />}>
            <Route path="/overview" element={<DashboardRoute fallback={<HomeLoadingState />}><OverviewPage /></DashboardRoute>} />
            <Route path="/performance" element={<DashboardRoute><PerformancePage /></DashboardRoute>} />
            <Route path="/errors" element={<DashboardRoute><ErrorsPage /></DashboardRoute>} />
            <Route path="/errors/:fingerprint" element={<DashboardRoute><ErrorDetailPage /></DashboardRoute>} />
            <Route path="/events" element={<DashboardRoute><EventsPage /></DashboardRoute>} />
            <Route path="/alerts" element={<DashboardRoute><AlertsPage /></DashboardRoute>} />
            <Route path="/source-maps" element={<DashboardRoute><SourceMapsPage /></DashboardRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </DashboardProvider>
  );
}

function DashboardRoute({ children, fallback = <PageSkeleton /> }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

function ProtectedLayout() {
  const { connection } = useDashboard();
  return connection ? <AppLayout /> : <Navigate to="/connect" replace />;
}
