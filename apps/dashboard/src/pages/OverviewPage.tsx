import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";
import {
  Badge,
  EmptyState,
  ErrorState,
  formatDate,
  formatMetric,
  LoadingState,
  PageHeader,
  StatCard,
} from "../components/Ui";

export function OverviewPage() {
  const { client, filters, refreshKey, refresh } = useDashboard();
  const location = useLocation();
  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const state = useApiData(async (signal) => {
    if (!client) throw new Error("尚未配置连接");
    const [overview, errors, releases] = await Promise.all([
      client.overview(apiFilters, signal),
      client.errors({ ...apiFilters, limit: 5, offset: 0 }, signal),
      client.releases(apiFilters, signal),
    ]);
    return { overview, errors, releases };
  }, [client, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.release, apiFilters.platform, refreshKey]);

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} onRetry={refresh} />;
  if (!state.data) return null;
  const { overview, errors, releases } = state.data;
  const errorRate = overview.totalEvents > 0
    ? `${((overview.errorEvents / overview.totalEvents) * 100).toFixed(1)}%`
    : "0%";

  return (
    <div className="page-stack">
      <PageHeader eyebrow="OVERVIEW" title="前端稳定性总览" description="从采集入口到处理结果，快速确认当前项目是否健康。" />
      <section className="stat-grid" aria-label="关键指标">
        <StatCard label="事件总量" value={overview.totalEvents.toLocaleString()} hint="当前筛选范围" />
        <StatCard label="错误事件" value={overview.errorEvents.toLocaleString()} hint={`错误率 ${errorRate}`} tone={overview.errorEvents ? "danger" : "default"} />
        <StatCard label="会话数" value={overview.sessions.toLocaleString()} hint="去重 session_id" />
        <StatCard label="处理失败" value={overview.failedEvents.toLocaleString()} hint="Processor 最终失败" tone={overview.failedEvents ? "danger" : "success"} />
      </section>
      <div className="content-grid two-thirds">
        <section className="panel">
          <div className="panel-heading"><div><span>WEB VITALS</span><h2>核心体验指标</h2></div><Link to={{ pathname: "/performance", search: location.search }}>查看趋势</Link></div>
          {overview.vitals.length ? (
            <div className="vitals-grid">
              {overview.vitals.map((vital) => (
                <article key={vital.metric} className="vital-item">
                  <div><strong>{vital.metric}</strong><Badge tone={vital.poor > 0 ? "danger" : "good"}>{vital.sampleCount} 样本</Badge></div>
                  <b>{formatMetric(vital.metric, vital.average)}</b>
                  <div className="rating-bar" aria-label={`${vital.metric} rating 分布`}>
                    <i className="good" style={{ flex: vital.good || 0.1 }} />
                    <i className="warning" style={{ flex: vital.needsImprovement || 0.1 }} />
                    <i className="danger" style={{ flex: vital.poor || 0.1 }} />
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="还没有性能样本" description="打开 demo-web 产生浏览器事件后，这里会显示 Web Vitals。" />}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span>RELEASES</span><h2>活跃版本</h2></div></div>
          {releases.length ? releases.slice(0, 5).map((release) => (
            <div className="release-row" key={release.release}>
              <div><strong>{release.release}</strong><span>{formatDate(release.lastSeen)}</span></div>
              <b>{release.eventCount}</b>
            </div>
          )) : <EmptyState title="暂无版本数据" description="事件携带 release 后会自动汇总。" />}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading"><div><span>ERROR GROUPS</span><h2>最近错误</h2></div><Link to={{ pathname: "/errors", search: location.search }}>查看全部</Link></div>
        {errors.items.length ? (
          <div className="table-wrap"><table><thead><tr><th>错误</th><th>位置</th><th>最近出现</th><th>次数</th></tr></thead><tbody>
            {errors.items.map((error) => <tr key={error.fingerprint}>
              <td><Link className="primary-link" to={{ pathname: `/errors/${encodeURIComponent(error.fingerprint)}`, search: location.search }}>{error.title || error.kind}</Link><small>{error.kind}</small></td>
              <td>{error.culprit || "—"}</td><td>{formatDate(error.lastSeen)}</td><td><Badge tone="danger">{error.eventCount}</Badge></td>
            </tr>)}
          </tbody></table></div>
        ) : <EmptyState title="当前范围内没有错误" description="这是好消息；也可以在 demo-web 主动触发测试错误。" />}
      </section>
    </div>
  );
}
