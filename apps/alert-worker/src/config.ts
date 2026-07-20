export interface AlertWorkerConfig {
  databaseUrl: string;
  pollIntervalMs: number;
  deliveryBatchSize: number;
  deliveryTimeoutMs: number;
  deliveryMaxAttempts: number;
  deliveryStaleAfterMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AlertWorkerConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? "postgres://monitor:monitor@localhost:5432/monitor",
    pollIntervalMs: positiveInt(env.ALERT_POLL_INTERVAL_MS, 30_000),
    deliveryBatchSize: positiveInt(env.ALERT_DELIVERY_BATCH_SIZE, 20),
    deliveryTimeoutMs: positiveInt(env.ALERT_DELIVERY_TIMEOUT_MS, 5_000),
    deliveryMaxAttempts: positiveInt(env.ALERT_DELIVERY_MAX_ATTEMPTS, 5),
    deliveryStaleAfterMs: positiveInt(env.ALERT_DELIVERY_STALE_AFTER_MS, 60_000),
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
