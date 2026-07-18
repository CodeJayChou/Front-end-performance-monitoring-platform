export interface GatewayConfig {
  host: string;
  port: number;
  databaseUrl: string;
  bodyLimit: number;
  maxBatchSize: number;
  maxEventBytes: number;
  rateLimitPerMinute: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    host: env.HOST ?? "0.0.0.0",
    port: parsePositiveInt(env.PORT, 3001),
    databaseUrl:
      env.DATABASE_URL ?? "postgres://monitor:monitor@localhost:5432/monitor",
    bodyLimit: parsePositiveInt(env.INGEST_BODY_LIMIT, 512 * 1024),
    maxBatchSize: parsePositiveInt(env.INGEST_MAX_BATCH_SIZE, 50),
    maxEventBytes: parsePositiveInt(env.INGEST_MAX_EVENT_BYTES, 64 * 1024),
    rateLimitPerMinute: parsePositiveInt(env.INGEST_RATE_LIMIT_PER_MINUTE, 600),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
