import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://monitor:monitor@localhost:5432/monitor";
const parsedDays = Number(process.env.RETENTION_DAYS ?? "30");
if (!Number.isInteger(parsedDays) || parsedDays < 1) {
  throw new Error("RETENTION_DAYS must be a positive integer");
}

const cutoff = new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1_000);
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const buckets = await client.query(
    "DELETE FROM metric_buckets_1m WHERE bucket_start < $1",
    [cutoff],
  );
  const groups = await client.query(
    "DELETE FROM error_groups WHERE last_seen < $1",
    [cutoff],
  );
  const events = await client.query(
    "DELETE FROM events WHERE event_timestamp < $1",
    [cutoff],
  );
  await client.query("COMMIT");
  console.info(JSON.stringify({
    retentionDays: parsedDays,
    cutoff: cutoff.toISOString(),
    deleted: {
      events: events.rowCount ?? 0,
      metricBuckets: buckets.rowCount ?? 0,
      errorGroups: groups.rowCount ?? 0,
    },
  }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
