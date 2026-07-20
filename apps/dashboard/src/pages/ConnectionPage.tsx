import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { ConnectionConfig } from "../api/types";
import { useDashboard } from "../state/DashboardContext";

export function ConnectionPage() {
  const { saveConnection } = useDashboard();
  const navigate = useNavigate();
  const [form, setForm] = useState<ConnectionConfig>({
    baseUrl: (import.meta.env.VITE_QUERY_API_URL as string | undefined) ?? "http://localhost:13002",
    projectId: (import.meta.env.VITE_PROJECT_ID as string | undefined) ?? "demo-project",
    adminKey: "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.baseUrl.trim() || !form.projectId.trim() || !form.adminKey.trim()) return;
    saveConnection(form);
    navigate("/overview", { replace: true });
  };

  return (
    <main className="connection-page">
      <section className="connection-intro">
        <p className="eyebrow">MONITOR CONSOLE</p>
        <h1>把浏览器信号变成可行动的证据。</h1>
        <p>连接本地 Query Service，查看错误、性能指标、版本与原始事件。管理密钥只保存在当前浏览器会话。</p>
        <div className="signal-flow" aria-label="监控数据链路">
          <span>SDK</span><i>→</i><span>Ingest</span><i>→</i><span>Process</span><i>→</i><span>Insight</span>
        </div>
      </section>
      <form className="connection-card" onSubmit={submit}>
        <div>
          <span className="status-dot" aria-hidden="true" />
          <strong>连接本地项目</strong>
          <p>默认配置对应当前 Docker MVP。</p>
        </div>
        <label>
          Query API 地址
          <input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} required />
        </label>
        <label>
          Project ID
          <input value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} required />
        </label>
        <label>
          管理密钥
          <input type="password" value={form.adminKey} onChange={(event) => setForm({ ...form, adminKey: event.target.value })} placeholder="输入本地 demo 管理密钥" autoComplete="off" required />
        </label>
        <button className="primary-button" type="submit">进入监控工作台</button>
        <small>密钥不会写入 URL 或持久化到 localStorage。</small>
      </form>
    </main>
  );
}
