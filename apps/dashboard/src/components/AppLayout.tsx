import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDashboard } from "../state/DashboardContext";
import { FilterBar } from "./FilterBar";

const links = [
  { to: "/overview", label: "项目总览", icon: "overview" },
  { to: "/performance", label: "性能监控", icon: "performance" },
  { to: "/errors", label: "错误追踪", icon: "errors" },
  { to: "/events", label: "事件浏览", icon: "events" },
  { to: "/alerts", label: "告警规则", icon: "alerts" },
  { to: "/source-maps", label: "Source Maps", icon: "source" },
];

export function AppLayout() {
  const { connection, clearConnection } = useDashboard();
  const location = useLocation();
  const navigate = useNavigate();

  const disconnect = () => {
    clearConnection();
    navigate("/connect", { replace: true });
  };

  return (
    <div className="app-shell font-sans text-ink">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-signal" aria-hidden="true"><span /></span>
          <div>
            <strong>Pulse</strong>
            <span>Observability</span>
          </div>
        </div>
        <div className="project-switcher">
          <span className="project-avatar">{connection?.projectId.slice(0, 1).toUpperCase()}</span>
          <div><small>当前项目</small><strong>{connection?.projectId}</strong></div>
          <span className="project-chevron" aria-hidden="true">⌄</span>
        </div>
        <p className="nav-caption">监控</p>
        <nav className="nav-list" aria-label="主导航">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={{ pathname: link.to, search: location.search }}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <NavIcon name={link.icon} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-project">
          <div className="system-state"><span /><div><strong>数据连接已建立</strong><small>15 秒自动刷新</small></div></div>
          <button className="sidebar-action" type="button" onClick={disconnect}><NavIcon name="switch" />切换连接</button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-context">
            <span>Projects</span><b>/</b><strong>{connection?.projectId}</strong>
          </div>
          <div className="topbar-search"><NavIcon name="search" /><span>搜索事件、错误或版本</span><kbd>⌘ K</kbd></div>
          <FilterBar />
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    performance: <><path d="M4 17l4-5 4 3 5-8 3 3" /><path d="M4 21h16" /></>,
    errors: <><path d="M12 3l9 16H3L12 3z" /><path d="M12 9v4" /><path d="M12 16h.01" /></>,
    events: <><path d="M5 5h14M5 12h14M5 19h14" /><circle cx="3" cy="5" r=".7" /><circle cx="3" cy="12" r=".7" /><circle cx="3" cy="19" r=".7" /></>,
    alerts: <><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    source: <><path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-3" /><path d="M13 3h8v8M21 3l-10 10" /></>,
    switch: <><path d="M7 7h11l-3-3M17 17H6l3 3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
