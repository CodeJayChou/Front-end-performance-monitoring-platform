import type { QueryConfig } from "./config";

export interface QueryFilters {
  from: Date;
  to: Date;
  environment?: string;
  release?: string;
  platform?: string;
  limit: number;
  offset: number;
}

export type FilterResult =
  | { ok: true; filters: QueryFilters }
  | { ok: false; reason: string };

export function parseFilters(
  query: Record<string, unknown>,
  config: QueryConfig,
  now = new Date(),
): FilterResult {
  const to = parseDate(query.to) ?? now;
  const from = parseDate(query.from) ?? new Date(to.getTime() - 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    return { ok: false, reason: "invalid_time_range" };
  }
  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs <= 0) return { ok: false, reason: "invalid_time_range" };
  if (rangeMs > config.maxRangeDays * 24 * 60 * 60 * 1_000) {
    return { ok: false, reason: "time_range_too_large" };
  }

  const limit = parseInteger(query.limit, config.defaultLimit);
  const offset = parseInteger(query.offset, 0);
  if (limit < 1 || limit > config.maxLimit || offset < 0) {
    return { ok: false, reason: "invalid_pagination" };
  }

  return {
    ok: true,
    filters: {
      from,
      to,
      environment: optionalString(query.environment),
      release: optionalString(query.release),
      platform: optionalString(query.platform),
      limit,
      offset,
    },
  };
}

function parseDate(value: unknown): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) return new Date(Number.NaN);
  return new Date(value);
}

function parseInteger(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return -1;
  return Number(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
