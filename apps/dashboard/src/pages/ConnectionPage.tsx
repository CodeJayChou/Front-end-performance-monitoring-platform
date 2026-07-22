import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { ConnectionConfig } from "../api/types";
import { LoginMascots } from "../components/LoginMascots";
import { useDashboard } from "../state/DashboardContext";

export function ConnectionPage() {
  const { saveConnection } = useDashboard();
  const navigate = useNavigate();
  const [form, setForm] = useState<ConnectionConfig>({
    baseUrl: (import.meta.env.VITE_QUERY_API_URL as string | undefined) ?? "http://localhost:13002",
    projectId: (import.meta.env.VITE_PROJECT_ID as string | undefined) ?? "demo-project",
    adminKey: "",
  });
  const [activeField, setActiveField] = useState<keyof ConnectionConfig | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.baseUrl.trim() || !form.projectId.trim() || !form.adminKey.trim()) return;
    saveConnection(form);
    navigate("/overview", { replace: true });
  };

  return (
    <main className="connection-page font-sans text-ink">
      <LoginMascots mode={activeField === "adminKey" && form.adminKey ? "secret" : activeField ? "typing" : "idle"} />
      <section className="connection-form-side">
        <form className="connection-login-form" onSubmit={submit}>
          <div className="mobile-login-brand"><span className="brand-signal" aria-hidden="true"><span /></span><strong>Pulse</strong></div>
          <header>
            <h1>欢迎回来！</h1>
            <p>连接监控项目，继续查看前端运行状态</p>
          </header>
          <label>
            Query API 地址
            <input value={form.baseUrl} onFocus={() => setActiveField("baseUrl")} onBlur={() => setActiveField(null)} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="请输入 Query API 地址" required />
          </label>
          <label>
            Project ID
            <input value={form.projectId} onFocus={() => setActiveField("projectId")} onBlur={() => setActiveField(null)} onChange={(event) => setForm({ ...form, projectId: event.target.value })} placeholder="请输入 Project ID" required />
          </label>
          <label>
            管理密钥
            <input type="password" value={form.adminKey} onFocus={() => setActiveField("adminKey")} onBlur={() => setActiveField(null)} onChange={(event) => setForm({ ...form, adminKey: event.target.value })} placeholder="请输入管理密钥" autoComplete="off" required />
          </label>
          <button className="connection-submit" type="submit"><span>进入监控工作台</span><i aria-hidden="true">→</i></button>
          <div className="connection-privacy"><span aria-hidden="true">⌁</span><p>管理密钥仅保存在当前浏览器会话，不会写入 URL 或 localStorage。</p></div>
        </form>
      </section>
    </main>
  );
}
