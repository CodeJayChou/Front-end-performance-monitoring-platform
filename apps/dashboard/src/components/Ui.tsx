import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

export function LoadingState({ label = "正在读取监控数据…" }: { label?: string }) {
  return <div className="state-box loading"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="state-box"><strong>{title}</strong><span>{description}</span></div>;
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="state-box error-state" role="alert">
      <strong>数据暂时不可用</strong>
      <span>{error.message}</span>
      <button type="button" onClick={onRetry}>重新加载</button>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Pagination({ page, pageSize, total, onPage }: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>第 {page} / {pages} 页 · 共 {total} 条</span>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>下一页</button>
      </div>
    </div>
  );
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "medium" }).format(date)
    : value;
}

export function formatMetric(metric: string, value: number | null): string {
  if (value === null) return "—";
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value)} ms`;
}
