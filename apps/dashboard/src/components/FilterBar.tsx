import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import type { DashboardFilters, TimeRange } from "../api/types";
import { AppIcon } from "./AppIcon";
import { FilterSelect, type FilterSelectOption } from "./FilterSelect";
import { LogoLoader } from "./Loading";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

const ranges: Array<{ value: TimeRange; label: string }> = [
  { value: "1h", label: "1 小时" },
  { value: "24h", label: "24 小时" },
  { value: "7d", label: "7 天" },
  { value: "30d", label: "30 天" },
];

const environments: FilterSelectOption[] = [
  { value: "", label: "全部环境" },
  { value: "development", label: "development" },
  { value: "production", label: "production" },
  { value: "integration", label: "integration" },
];

const platforms: FilterSelectOption[] = [
  { value: "", label: "全部平台" },
  { value: "web", label: "web" },
  { value: "react", label: "react" },
  { value: "vue", label: "vue" },
];

export function FilterBar() {
  const { client, filters, setFilters, refresh, refreshKey } = useDashboard();
  const apiFilters = useMemo(() => toApiFilters({ ...filters, release: "" }), [filters]);
  const releases = useApiData(
    (signal) => client ? client.releases(apiFilters, signal) : Promise.resolve([]),
    [client, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.platform, refreshKey],
  );
  const releaseOptions = useMemo<FilterSelectOption[]>(() => [
    { value: "", label: "全部版本" },
    { value: "(none)", label: "无版本" },
    ...(releases.data ?? []).map((release) => ({ value: release.release, label: release.release })),
  ], [releases.data]);

  const update = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="filter-bar" aria-label="全局筛选">
      <FilterSelect label="时间" value={filters.range} options={ranges} onChange={(value) => update("range", value as TimeRange)} />
      <FilterSelect label="环境" value={filters.environment} options={environments} onChange={(value) => update("environment", value)} />
      <FilterSelect label="版本" value={filters.release} options={releaseOptions} onChange={(value) => update("release", value)} />
      <FilterSelect label="平台" value={filters.platform} options={platforms} onChange={(value) => update("platform", value)} />
      <button className="refresh-button" type="button" onClick={refresh} aria-label="刷新数据" aria-busy={releases.refreshing}>
        {releases.refreshing ? <LogoLoader size="xs" /> : <AppIcon icon={RefreshCw} size="sm" />}<span>刷新</span>
      </button>
    </div>
  );
}
