import { useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "../components/EChart";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "../components/Ui";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

const metrics = ["LCP", "CLS", "INP", "FCP", "FP"];

export function PerformancePage() {
  const { client, filters, refreshKey, refresh } = useDashboard();
  const [metric, setMetric] = useState("LCP");
  const apiFilters = useMemo(() => toApiFilters(filters), [filters, refreshKey]);
  const state = useApiData(
    (signal) => client ? client.performance(apiFilters, metric, signal) : Promise.reject(new Error("尚未配置连接")),
    [client, metric, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.release, apiFilters.platform, refreshKey],
  );
  const option = useMemo<EChartsCoreOption>(() => {
    const points = state.data ?? [];
    const ratings = ["good", "needs-improvement", "poor"];
    const colors: Record<string, string> = { good: "#20a777", "needs-improvement": "#d9962f", poor: "#d8525e" };
    return {
      animationDuration: 250,
      color: ratings.map((rating) => colors[rating] ?? "#617084"),
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: "#738094" } },
      grid: { left: 52, right: 24, top: 28, bottom: 58 },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "#dce2e9" } },
        axisLabel: { color: "#738094" },
      },
      yAxis: {
        type: "value",
        name: metric === "CLS" ? "score" : "ms",
        splitLine: { lineStyle: { color: "#edf0f3" } },
        axisLabel: { color: "#738094" },
      },
      series: ratings.map((rating) => ({
        name: rating,
        type: "line",
        smooth: true,
        symbolSize: 6,
        connectNulls: false,
        data: points.filter((point) => point.rating === rating).map((point) => [point.bucketStart, point.average]),
      })),
    };
  }, [metric, state.data]);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="PERFORMANCE" title="真实用户性能" description="按一分钟聚合观察 Core Web Vitals 的变化与质量分布。" action={
        <label className="metric-select">指标<select value={metric} onChange={(event) => setMetric(event.target.value)}>{metrics.map((item) => <option key={item}>{item}</option>)}</select></label>
      } />
      {!filters.release ? (
        <div className="data-scope-note" role="status">
          <strong>当前正在合并全部版本的数据。</strong>
          不同测试场景和历史异常样本会共同影响平均值及纵轴范围；复核单次实验时请在顶部选择对应版本。
        </div>
      ) : null}
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span>{metric} SERIES · {filters.release || "全部版本"}</span><h2>{metric} 时间趋势</h2></div></div>
        {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} onRetry={refresh} /> : state.data?.length ? <EChart option={option} label={`${metric} 按 rating 分组的时间趋势`} /> : <EmptyState title={`暂无 ${metric} 数据`} description="运行浏览器演示并等待 Processor 完成聚合后再刷新。" />}
      </section>
      {state.data?.length ? <section className="panel"><div className="panel-heading"><div><span>BUCKET DETAILS</span><h2>聚合明细</h2></div></div><div className="table-wrap"><table><thead><tr><th>时间</th><th>评级</th><th>平均</th><th>最小</th><th>最大</th><th>样本</th></tr></thead><tbody>{state.data.slice(-50).reverse().map((point, index) => <tr key={`${point.bucketStart}-${point.rating}-${index}`}><td>{new Date(point.bucketStart).toLocaleString("zh-CN")}</td><td>{point.rating}</td><td>{point.average.toFixed(metric === "CLS" ? 3 : 0)}</td><td>{point.minimum.toFixed(metric === "CLS" ? 3 : 0)}</td><td>{point.maximum.toFixed(metric === "CLS" ? 3 : 0)}</td><td>{point.sampleCount}</td></tr>)}</tbody></table></div></section> : null}
    </div>
  );
}
