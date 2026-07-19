import { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Badge, EmptyState, ErrorState, formatDate, LoadingState, PageHeader } from "../components/Ui";
import { JsonViewer } from "../components/JsonViewer";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

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
  const { group, events } = state.data;

  return (
    <div className="page-stack">
      <Link className="back-link" to={{ pathname: "/errors", search: location.search }}>← 返回错误列表</Link>
      <PageHeader eyebrow={group.kind || "ERROR DETAIL"} title={group.title || "未命名错误"} description={group.culprit || "暂无定位信息"} />
      <section className="detail-hero">
        <div><span>事件次数</span><strong>{group.eventCount}</strong></div>
        <div><span>首次出现</span><strong>{formatDate(group.firstSeen)}</strong></div>
        <div><span>最近出现</span><strong>{formatDate(group.lastSeen)}</strong></div>
        <div><span>指纹</span><code>{group.fingerprint}</code></div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span>IMPACT</span><h2>影响范围</h2></div></div>
        <div className="badge-row spacious">
          {group.environments.map((item) => <Badge key={`env-${item}`}>{item}</Badge>)}
          {group.releases.map((item) => <Badge key={`release-${item}`} tone="warning">{item}</Badge>)}
          {group.platforms.map((item) => <Badge key={`platform-${item}`}>{item}</Badge>)}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span>RECENT SAMPLES</span><h2>最近事件样本</h2></div></div>
        {events.length ? <div className="event-samples">{events.map((event) => <details key={event.eventId} className="event-sample"><summary><span>{formatDate(event.eventTimestamp)}</span><span>{event.environment} · {event.release ?? "no release"}</span><code>{event.eventId.slice(0, 12)}</code></summary><div className="json-grid"><div><h3>Payload</h3><JsonViewer value={event.payload} /></div><div><h3>Context</h3><JsonViewer value={event.context} /></div></div></details>)}</div> : <EmptyState title="暂无事件样本" description="该错误组在当前筛选条件下没有原始事件。" />}
      </section>
    </div>
  );
}
