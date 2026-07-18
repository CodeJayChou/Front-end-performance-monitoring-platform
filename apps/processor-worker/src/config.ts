export interface ProcessorConfig {
  databaseUrl: string;
  batchSize: number;
  pollIntervalMs: number;
  staleAfterMs: number;
  maxAttempts: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProcessorConfig {
  return {
    databaseUrl:
      env.DATABASE_URL ?? "postgres://monitor:monitor@localhost:5432/monitor",
    batchSize: parsePositiveInt(env.PROCESSOR_BATCH_SIZE, 50),
    pollIntervalMs: parsePositiveInt(env.PROCESSOR_POLL_INTERVAL_MS, 1_000),
    staleAfterMs: parsePositiveInt(env.PROCESSOR_STALE_AFTER_MS, 30_000),
    maxAttempts: parsePositiveInt(env.PROCESSOR_MAX_ATTEMPTS, 5),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
