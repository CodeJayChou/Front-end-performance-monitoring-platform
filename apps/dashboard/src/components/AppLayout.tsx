import { BellRing, FileCode2, Gauge, LayoutDashboard, ListTree, TriangleAlert, Unplug } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDashboard } from "../state/DashboardContext";
import { AppIcon } from "./AppIcon";
import { BrandSignal } from "./BrandSignal";
import { FilterBar } from "./FilterBar";

const links = [
  { to: "/overview", label: "项目总览", icon: LayoutDashboard },
  { to: "/performance", label: "性能监控", icon: Gauge },
  { to: "/errors", label: "错误追踪", icon: TriangleAlert },
  { to: "/events", label: "事件浏览", icon: ListTree },
  { to: "/alerts", label: "告警规则", icon: BellRing },
  { to: "/source-maps", label: "Source Maps", icon: FileCode2 },
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
          <BrandSignal />
          <div>
            <strong>Pulse</strong>
            <span>Observability</span>
          </div>
        </div>
        <p className="nav-caption">监控</p>
        <nav className="nav-list" aria-label="主导航">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={{ pathname: link.to, search: location.search }}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <AppIcon icon={link.icon} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-project" aria-label={`当前项目 ${connection?.projectId}`}>
            <span className="project-avatar">{connection?.projectId.slice(0, 1).toUpperCase()}</span>
            <div><small>当前项目</small><strong>{connection?.projectId}</strong></div>
          </div>
          <FilterBar />
          <div className="topbar-actions">
            <div className="topbar-system-state" aria-label="数据连接已建立，15 秒自动刷新"><span /><strong>已连接</strong><small>15 秒刷新</small></div>
            <button className="topbar-disconnect" type="button" onClick={disconnect}><AppIcon icon={Unplug} size="sm" />切换连接</button>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
