import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AsyncPage, TableSkeleton } from "../components/Loading";
import { Badge, EmptyState, ErrorState, formatDate, PageHeader, Pagination } from "../components/Ui";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

const PAGE_SIZE = 25;

export function ErrorsPage() {
  const { client, filters, refreshKey, refresh } = useDashboard();
  const [page, setPage] = useState(1);
  const location = useLocation();
  const apiFilters = useMemo(
    () => toApiFilters(filters, new Date(), { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    [filters, page, refreshKey],
  );
  const state = useApiData(
    (signal) => client ? client.errors(apiFilters, signal) : Promise.reject(new Error("尚未配置连接")),
    [client, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.release, apiFilters.platform, apiFilters.offset, refreshKey],
  );

  return (
    <AsyncPage refreshing={state.refreshing} error={state.data ? state.error : null}>
      <PageHeader eyebrow="ERROR MONITORING" title="错误分组" description="通过稳定指纹聚合同类错误，优先处理频繁且最近仍在发生的问题。" />
      <section className="panel">
        {state.loading ? <TableSkeleton /> : state.error && !state.data ? <ErrorState error={state.error} onRetry={refresh} /> : state.data?.items.length ? <>
          <div className="table-wrap"><table><thead><tr><th>错误</th><th>位置</th><th>影响范围</th><th>首次 / 最近</th><th>次数</th></tr></thead><tbody>{state.data.items.map((error) => <tr key={error.fingerprint}>
            <td><Link className="primary-link" to={{ pathname: `/errors/${encodeURIComponent(error.fingerprint)}`, search: location.search }}>{error.title || "未命名错误"}</Link><small>{error.kind} · {error.fingerprint.slice(0, 12)}</small><div className="badge-row"><Badge tone={error.status === "resolved" ? "good" : error.status === "ignored" ? "neutral" : "danger"}>{error.status === "resolved" ? "已解决" : error.status === "in_progress" ? "处理中" : error.status === "ignored" ? "已忽略" : "未解决"}</Badge>{error.regressionCount > 0 ? <Badge tone="warning">回归 {error.regressionCount}</Badge> : null}</div></td>
            <td>{error.culprit || "—"}</td>
            <td><div className="badge-row">{error.environments.map((item) => <Badge key={item}>{item}</Badge>)}{error.platforms.map((item) => <Badge key={item}>{item}</Badge>)}</div></td>
            <td><small>{formatDate(error.firstSeen)}</small><br />{formatDate(error.lastSeen)}</td>
            <td><Badge tone="danger">{error.eventCount}</Badge></td>
          </tr>)}</tbody></table></div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={state.data.total} onPage={setPage} />
        </> : <EmptyState title="当前筛选范围内没有错误" description="可以在 demo-web 中触发未捕获异常来验证采集链路。" />}
      </section>
    </AsyncPage>
  );
}
