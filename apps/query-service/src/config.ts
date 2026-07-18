export interface QueryConfig {
  host: string;
  port: number;
  databaseUrl: string;
  maxRangeDays: number;
  defaultLimit: number;
  maxLimit: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): QueryConfig {
  return {
    host: env.HOST ?? "0.0.0.0",
    port: parsePositiveInt(env.PORT, 3002),
    databaseUrl:
      env.DATABASE_URL ?? "postgres://monitor:monitor@localhost:5432/monitor",
    maxRangeDays: parsePositiveInt(env.QUERY_MAX_RANGE_DAYS, 31),
    defaultLimit: parsePositiveInt(env.QUERY_DEFAULT_LIMIT, 50),
    maxLimit: parsePositiveInt(env.QUERY_MAX_LIMIT, 200),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
