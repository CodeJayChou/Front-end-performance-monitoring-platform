import { useMemo } from "react";
import type { DashboardFilters, TimeRange } from "../api/types";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

const ranges: Array<{ value: TimeRange; label: string }> = [
  { value: "1h", label: "1 小时" },
  { value: "24h", label: "24 小时" },
  { value: "7d", label: "7 天" },
  { value: "30d", label: "30 天" },
];

export function FilterBar() {
  const { client, filters, setFilters, refresh, refreshKey } = useDashboard();
  const apiFilters = useMemo(() => toApiFilters({ ...filters, release: "" }), [filters]);
  const releases = useApiData(
    (signal) => client ? client.releases(apiFilters, signal) : Promise.resolve([]),
    [client, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.platform, refreshKey],
  );

  const update = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="filter-bar" aria-label="全局筛选">
      <label>
        <span>时间</span>
        <select value={filters.range} onChange={(event) => update("range", event.target.value as TimeRange)}>
          {ranges.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
        </select>
      </label>
      <label>
        <span>环境</span>
        <select value={filters.environment} onChange={(event) => update("environment", event.target.value)}>
          <option value="">全部</option>
          <option value="development">development</option>
          <option value="production">production</option>
          <option value="integration">integration</option>
        </select>
      </label>
      <label>
        <span>版本</span>
        <select value={filters.release} onChange={(event) => update("release", event.target.value)}>
          <option value="">全部</option>
          <option value="(none)">无版本</option>
          {releases.data?.map((release) => (
            <option key={release.release} value={release.release}>{release.release}</option>
          ))}
        </select>
      </label>
      <label>
        <span>平台</span>
        <select value={filters.platform} onChange={(event) => update("platform", event.target.value)}>
          <option value="">全部</option>
          <option value="web">web</option>
          <option value="react">react</option>
          <option value="vue">vue</option>
        </select>
      </label>
      <button className="refresh-button" type="button" onClick={refresh} aria-label="刷新数据">
        <span aria-hidden="true">↻</span> 刷新
      </button>
    </div>
  );
}
