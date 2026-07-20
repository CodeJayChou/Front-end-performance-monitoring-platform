import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { ErrorGroup, ErrorIssueStatus, EventRecord, SymbolicatedFrame } from "../api/types";
import { Badge, EmptyState, ErrorState, formatDate, LoadingState, PageHeader } from "../components/Ui";
import { JsonViewer } from "../components/JsonViewer";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

const statusLabels: Record<ErrorIssueStatus, string> = {
  unresolved: "未解决",
  in_progress: "处理中",
  resolved: "已解决",
  ignored: "已忽略",
};

export function ErrorDetailPage() {
  const { fingerprint = "" } = useParams();
  const location = useLocation();
  const { client, filters, refreshKey, refresh } = useDashboard();
  const apiFilters = useMemo(
    () => toApiFilters(filters, new Date(), { limit: 20, offset: 0 }),
    [filters, refreshKey],
  );
  const state = useApiData(
    (signal) => client ? client.errorDetail(fingerprint, apiFilters, signal) : Promise.reject(new Error("尚未配置连接")),
    [client, fingerprint, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.release, apiFilters.platform, refreshKey],
  );

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} onRetry={refresh} />;
  if (!state.data) return <EmptyState title="错误组不存在" description="它可能不在当前时间范围或筛选条件内。" />;
  const { group, events, history } = state.data;
  const stackEvent = events.find((event) => event.symbolicatedStack.length > 0) ?? events[0];
  const breadcrumbs = stackEvent ? breadcrumbsFrom(stackEvent.context) : [];

  return (
    <div className="page-stack">
      <Link className="back-link" to={{ pathname: "/errors", search: location.search }}>← 返回错误列表</Link>
      <PageHeader
        eyebrow={group.kind || "ERROR DETAIL"}
        title={group.title || "未命名错误"}
        description={group.culprit || "暂无定位信息"}
        action={<IssueControls group={group} fingerprint={fingerprint} />}
      />
      {group.lastRegressedAt ? <div className="regression-notice"><strong>检测到回归</strong>该错误在解决后再次出现，累计回归 {group.regressionCount} 次，最近一次为 {formatDate(group.lastRegressedAt)}。</div> : null}
      <section className="detail-hero">
        <div><span>事件次数</span><strong>{group.eventCount}</strong></div>
        <div><span>首次出现</span><strong>{formatDate(group.firstSeen)}</strong></div>
        <div><span>最近出现</span><strong>{formatDate(group.lastSeen)}</strong></div>
        <div><span>指纹</span><code>{group.fingerprint}</code></div>
      </section>

      <div className="content-grid error-evidence-grid">
        <section className="panel">
          <div className="panel-heading"><div><span>SOURCE STACK</span><h2>源码调用栈</h2></div>{stackEvent ? <SymbolicationBadge event={stackEvent} /> : null}</div>
          {stackEvent?.symbolicatedStack.length ? <SourceStack frames={stackEvent.symbolicatedStack} /> : <EmptyState title="暂未还原源码栈" description={symbolicationHint(stackEvent)} />}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span>BREADCRUMBS</span><h2>错误前行为轨迹</h2></div></div>
          {breadcrumbs.length ? <ol className="breadcrumb-timeline">{breadcrumbs.map((item, index) => <li key={`${item.timestamp}-${index}`}><time>{formatBreadcrumbTime(item.timestamp)}</time><span>{item.message}</span></li>)}</ol> : <EmptyState title="没有 Breadcrumb" description="SDK Scope 收到用户行为后会在这里按时间展示。" />}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading"><div><span>IMPACT</span><h2>影响范围</h2></div></div>
        <div className="badge-row spacious">
          <Badge tone={group.status === "resolved" ? "good" : group.status === "ignored" ? "neutral" : "danger"}>{statusLabels[group.status]}</Badge>
          {group.environments.map((item) => <Badge key={`env-${item}`}>{item}</Badge>)}
          {group.releases.map((item) => <Badge key={`release-${item}`} tone="warning">{item}</Badge>)}
          {group.platforms.map((item) => <Badge key={`platform-${item}`}>{item}</Badge>)}
        </div>
        {group.note ? <p className="issue-note">{group.note}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span>WORKFLOW</span><h2>处置历史</h2></div></div>
        {history.length ? <div className="issue-history">{history.map((item) => <div key={item.id}><span>{historyLabel(item.action)}</span><strong>{item.fromStatus ? statusLabel(item.fromStatus) : "—"} → {item.toStatus ? statusLabel(item.toStatus) : "—"}</strong><p>{item.note || "无备注"}</p><time>{formatDate(item.createdAt)}</time></div>)}</div> : <EmptyState title="暂无处置记录" description="更新状态或备注后，变更历史会显示在这里。" />}
      </section>

      <section className="panel">
        <div className="panel-heading"><div><span>RECENT SAMPLES</span><h2>最近事件样本</h2></div></div>
        {events.length ? <div className="event-samples">{events.map((event) => <details key={event.eventId} className="event-sample"><summary><span>{formatDate(event.eventTimestamp)}</span><span>{event.environment} · {event.release ?? "no release"}</span><code>{event.eventId.slice(0, 12)}</code></summary><div className="json-grid"><div><h3>Payload</h3><JsonViewer value={event.payload} /></div><div><h3>Context</h3><JsonViewer value={event.context} /></div></div></details>)}</div> : <EmptyState title="暂无事件样本" description="该错误组在当前筛选条件下没有原始事件。" />}
      </section>
    </div>
  );
}

function IssueControls({ group, fingerprint }: { group: ErrorGroup; fingerprint: string }) {
  const { client, refresh } = useDashboard();
  const [status, setStatus] = useState<ErrorIssueStatus>(group.status);
  const [note, setNote] = useState(group.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!client) return;
    setSaving(true);
    setError(null);
    try {
      await client.updateErrorIssue(fingerprint, status, note || null);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新失败");
    } finally {
      setSaving(false);
    }
  };

  return <form className="issue-controls" onSubmit={submit}><select aria-label="错误状态" value={status} onChange={(event) => setStatus(event.target.value as ErrorIssueStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="处置备注" maxLength={2000} placeholder="添加处置备注" value={note} onChange={(event) => setNote(event.target.value)} /><button className="primary-button" type="submit" disabled={saving}>{saving ? "保存中…" : "更新状态"}</button>{error ? <span role="alert">{error}</span> : null}</form>;
}

function SourceStack({ frames }: { frames: SymbolicatedFrame[] }) {
  return <ol className="source-stack">{frames.map((frame, index) => <li className={frame.inApp ? "in-app" : "third-party"} key={`${frame.originalFile}-${frame.originalLine}-${index}`}><div><Badge tone={frame.inApp ? "good" : "neutral"}>{frame.inApp ? "业务代码" : "第三方"}</Badge><strong>{frame.originalFunctionName || "anonymous"}</strong></div><code>{frame.originalFile}:{frame.originalLine}:{frame.originalCol}</code>{frame.sourceLine ? <pre>{frame.sourceLine}</pre> : null}<small>生成位置：{frame.file ?? "unknown"}:{frame.line ?? 0}:{frame.col ?? 0}</small></li>)}</ol>;
}

function SymbolicationBadge({ event }: { event: EventRecord }) {
  return <Badge tone={event.symbolicationStatus === "symbolicated" ? "good" : "warning"}>{event.symbolicationStatus === "symbolicated" ? "已还原" : event.symbolicationStatus || "未处理"}</Badge>;
}

function symbolicationHint(event: EventRecord | undefined): string {
  if (!event) return "当前筛选范围内没有错误样本。";
  if (event.symbolicationStatus === "no_release") return "事件没有 Release，无法匹配 Source Map。";
  if (event.symbolicationStatus === "map_not_found") return "没有找到与 Release 和生成文件路径匹配的 Source Map。";
  if (event.symbolicationStatus === "no_stack") return "该错误事件没有可解析的结构化调用栈。";
  if (event.symbolicationStatus === "failed") return "Source Map 解析失败；原始事件仍已正常保存。";
  return "上传匹配的 Source Map 后，新进入 Processor 的错误会显示源码栈。";
}

function breadcrumbsFrom(context: unknown): Array<{ message: string; timestamp: number | string }> {
  if (!context || typeof context !== "object") return [];
  const value = (context as Record<string, unknown>).breadcrumbs;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.message !== "string") return [];
    return [{ message: row.message, timestamp: typeof row.timestamp === "number" || typeof row.timestamp === "string" ? row.timestamp : "" }];
  });
}

function formatBreadcrumbTime(value: number | string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("zh-CN") : "—";
}

function historyLabel(action: string): string {
  return action === "regressed" ? "错误回归" : action === "created" ? "首次发现" : action === "note_changed" ? "备注更新" : "状态变更";
}

function statusLabel(status: string): string {
  return statusLabels[status as ErrorIssueStatus] ?? status;
}
