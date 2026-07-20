import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDashboard } from "../state/DashboardContext";
import { FilterBar } from "./FilterBar";

const links = [
  { to: "/overview", label: "总览", mark: "O" },
  { to: "/performance", label: "性能", mark: "P" },
  { to: "/errors", label: "错误", mark: "E" },
  { to: "/events", label: "事件", mark: "R" },
  { to: "/alerts", label: "告警", mark: "A" },
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-signal" aria-hidden="true" />
          <div>
            <strong>Monitor</strong>
            <span>Console</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="主导航">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={{ pathname: link.to, search: location.search }}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span className="nav-mark" aria-hidden="true">{link.mark}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-project">
          <span>当前项目</span>
          <strong>{connection?.projectId}</strong>
          <button className="text-button" type="button" onClick={disconnect}>切换连接</button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">FRONT-END OBSERVABILITY</p>
            <strong>本地监控工作台</strong>
          </div>
          <FilterBar />
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
