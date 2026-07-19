import type { ApiFilters, DashboardFilters, TimeRange } from "../api/types";

const RANGE_MS: Record<TimeRange, number> = {
  "1h": 60 * 60 * 1_000,
  "24h": 24 * 60 * 60 * 1_000,
  "7d": 7 * 24 * 60 * 60 * 1_000,
  "30d": 30 * 24 * 60 * 60 * 1_000,
};

export const DEFAULT_FILTERS: DashboardFilters = {
  range: "24h",
  environment: "",
  release: "",
  platform: "",
};

export function toApiFilters(
  filters: DashboardFilters,
  now = new Date(),
  pagination?: { limit: number; offset: number },
): ApiFilters {
  return {
    from: new Date(now.getTime() - RANGE_MS[filters.range]).toISOString(),
    to: now.toISOString(),
    environment: filters.environment || undefined,
    release: filters.release || undefined,
    platform: filters.platform || undefined,
    ...pagination,
  };
}

export function filtersFromSearch(search: URLSearchParams): DashboardFilters {
  const candidate = search.get("range");
  const range: TimeRange = candidate && candidate in RANGE_MS
    ? (candidate as TimeRange)
    : DEFAULT_FILTERS.range;
  return {
    range,
    environment: search.get("environment") ?? "",
    release: search.get("release") ?? "",
    platform: search.get("platform") ?? "",
  };
}

export function filtersToSearch(
  filters: DashboardFilters,
  current: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const pairs: Array<[keyof DashboardFilters, string]> = [
    ["range", filters.range],
    ["environment", filters.environment],
    ["release", filters.release],
    ["platform", filters.platform],
  ];
  for (const [key, value] of pairs) {
    if (value && !(key === "range" && value === DEFAULT_FILTERS.range)) next.set(key, value);
    else next.delete(key);
  }
  return next;
}
