import { useMemo, useState } from "react";
import type { EventRecord } from "../api/types";
import { Badge, EmptyState, ErrorState, formatDate, LoadingState, PageHeader, Pagination } from "../components/Ui";
import { JsonViewer } from "../components/JsonViewer";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

const PAGE_SIZE = 25;

export function EventsPage() {
  const { client, filters, refreshKey, refresh } = useDashboard();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const apiFilters = useMemo(
    () => toApiFilters(filters, new Date(), { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    [filters, page, refreshKey],
  );
  const state = useApiData(
    (signal) => client ? client.events(apiFilters, signal) : Promise.reject(new Error("尚未配置连接")),
    [client, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.release, apiFilters.platform, apiFilters.offset, refreshKey],
  );

  return (
    <div className="page-stack">
      <PageHeader eyebrow="RAW EVENTS" title="事件流" description="查看服务端接收到的标准事件、上下文与处理状态。" />
      <section className="panel">
        {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} onRetry={refresh} /> : state.data?.items.length ? <>
          <div className="table-wrap"><table><thead><tr><th>类型</th><th>时间</th><th>会话</th><th>环境 / 版本</th><th>处理状态</th><th /></tr></thead><tbody>{state.data.items.map((event) => <tr key={event.eventId}>
            <td><Badge tone={event.type === "error" ? "danger" : "neutral"}>{event.type ?? "unknown"}</Badge></td>
            <td>{formatDate(event.eventTimestamp)}</td><td><code>{event.sessionId.slice(0, 12)}</code></td>
            <td>{event.environment}<small>{event.release ?? "no release"}</small></td>
            <td><Badge tone={event.processingStatus === "failed" ? "danger" : event.processingStatus === "processed" ? "good" : "warning"}>{event.processingStatus ?? "unknown"}</Badge></td>
            <td><button className="text-button" type="button" onClick={() => setSelected(event)}>查看</button></td>
          </tr>)}</tbody></table></div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={state.data.total} onPage={(next) => { setPage(next); setSelected(null); }} />
        </> : <EmptyState title="当前范围没有事件" description="启动 demo-web 并触发事件后刷新本页。" />}
      </section>
      {selected ? <aside className="event-drawer" aria-label="事件详情">
        <div className="drawer-heading"><div><span>{selected.type}</span><strong>{selected.eventId}</strong></div><button type="button" onClick={() => setSelected(null)} aria-label="关闭事件详情">×</button></div>
        <dl><div><dt>发生时间</dt><dd>{formatDate(selected.eventTimestamp)}</dd></div><div><dt>平台</dt><dd>{selected.platform}</dd></div><div><dt>环境</dt><dd>{selected.environment}</dd></div><div><dt>版本</dt><dd>{selected.release ?? "—"}</dd></div></dl>
        <h3>Payload</h3><JsonViewer value={selected.payload} />
        <h3>Context</h3><JsonViewer value={selected.context} />
        {selected.trace ? <><h3>Trace</h3><JsonViewer value={selected.trace} /></> : null}
      </aside> : null}
    </div>
  );
}
