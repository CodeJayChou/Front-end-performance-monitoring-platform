import { useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "../components/EChart";
import { FilterSelect } from "../components/FilterSelect";
import { AsyncPage, ChartSkeleton } from "../components/Loading";
import { EmptyState, ErrorState, PageHeader } from "../components/Ui";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

const metrics = ["LCP", "CLS", "INP", "FCP", "FP"];
const metricOptions = metrics.map((value) => ({ value, label: value }));
const scenarios = [
  { value: "", label: "全部场景" },
  { value: "default", label: "默认页面" },
  { value: "slow-lcp", label: "慢 LCP" },
  { value: "blocked-fcp", label: "阻塞 FCP" },
];

export function PerformancePage() {
  const { client, filters, refreshKey, refresh } = useDashboard();
  const [metric, setMetric] = useState("LCP");
  const [scenario, setScenario] = useState("");
  const apiFilters = useMemo(() => toApiFilters(filters), [filters, refreshKey]);
  const state = useApiData(
    (signal) => client ? client.performance({ ...apiFilters, scenario: scenario || undefined }, metric, signal) : Promise.reject(new Error("尚未配置连接")),
    [client, metric, scenario, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.release, apiFilters.platform, refreshKey],
  );
  const option = useMemo<EChartsCoreOption>(() => {
    const points = state.data ?? [];
    const ratings = ["good", "needs-improvement", "poor"];
    const colors: Record<string, string> = { good: "#20a777", "needs-improvement": "#d9962f", poor: "#d8525e" };
    const p75ByBucket = new Map<string, number>();
    for (const point of points) {
      if (point.p75 !== null) p75ByBucket.set(point.bucketStart, point.p75);
    }
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
      series: [
        {
          name: "P75",
          type: "line",
          smooth: true,
          symbolSize: 7,
          lineStyle: { width: 3, color: "#315efb" },
          itemStyle: { color: "#315efb" },
          data: [...p75ByBucket].map(([bucketStart, value]) => [bucketStart, value]),
        },
        ...ratings.map((rating) => ({
          name: `${rating} 平均`,
          type: "line",
          smooth: true,
          symbolSize: 5,
          connectNulls: false,
          data: points.filter((point) => point.rating === rating).map((point) => [point.bucketStart, point.average]),
        })),
      ],
    };
  }, [metric, state.data]);

  return (
    <AsyncPage refreshing={state.refreshing} error={state.data ? state.error : null}>
      <PageHeader eyebrow="PERFORMANCE" title="真实用户性能" description="按一分钟聚合观察 Core Web Vitals 的变化与质量分布。" action={
        <div className="performance-selectors">
          <FilterSelect label="场景" value={scenario} options={scenarios} variant="field" onChange={setScenario} />
          <FilterSelect label="指标" value={metric} options={metricOptions} variant="field" onChange={setMetric} />
        </div>
      } />
      {!filters.release ? (
        <div className="data-scope-note" role="status">
          <strong>当前正在合并全部版本的数据。</strong>
          不同测试场景和历史异常样本会共同影响平均值及纵轴范围；复核单次实验时请在顶部选择对应版本。
        </div>
      ) : null}
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span>{metric} SERIES · {filters.release || "全部版本"}</span><h2>{metric} 时间趋势</h2></div></div>
        {state.loading ? <ChartSkeleton /> : state.error && !state.data ? <ErrorState error={state.error} onRetry={refresh} /> : state.data?.length ? <EChart option={option} label={`${metric} 按 rating 分组的时间趋势`} /> : <EmptyState title={`暂无 ${metric} 数据`} description="运行浏览器演示并等待 Processor 完成聚合后再刷新。" />}
      </section>
      {state.data?.length ? <section className="panel"><div className="panel-heading"><div><span>BUCKET DETAILS</span><h2>聚合明细</h2></div></div><div className="table-wrap"><table><thead><tr><th>时间</th><th>评级</th><th>P75</th><th>平均</th><th>最小</th><th>最大</th><th>样本</th></tr></thead><tbody>{state.data.slice(-50).reverse().map((point, index) => <tr key={`${point.bucketStart}-${point.rating}-${index}`}><td>{new Date(point.bucketStart).toLocaleString("zh-CN")}</td><td>{point.rating}</td><td>{point.p75 === null ? "—" : point.p75.toFixed(metric === "CLS" ? 3 : 0)}</td><td>{point.average.toFixed(metric === "CLS" ? 3 : 0)}</td><td>{point.minimum.toFixed(metric === "CLS" ? 3 : 0)}</td><td>{point.maximum.toFixed(metric === "CLS" ? 3 : 0)}</td><td>{point.sampleCount}</td></tr>)}</tbody></table></div></section> : null}
    </AsyncPage>
  );
}
