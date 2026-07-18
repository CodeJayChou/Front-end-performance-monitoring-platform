import type { Pool, PoolClient } from "pg";
import type { ClaimedEvent, EventAnalysis } from "./types";

interface ClaimedRow {
  id: string;
  project_id: string;
  event_id: string;
  type: string;
  event_timestamp: Date;
  environment: string;
  release: string | null;
  platform: string;
  payload: unknown;
  processing_attempts: number;
}

export class ProcessorRepository {
  constructor(private readonly pool: Pool) {}

  async claimBatch(limit: number, staleAfterMs: number): Promise<ClaimedEvent[]> {
    const result = await this.pool.query<ClaimedRow>(
      `WITH candidates AS (
         SELECT id
         FROM events
         WHERE processing_status = 'pending'
            OR (processing_status = 'processing'
                AND processing_started_at < now() - ($2 * interval '1 millisecond'))
         ORDER BY received_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE events AS event
       SET processing_status = 'processing',
           processing_started_at = now(),
           processing_attempts = processing_attempts + 1,
           processing_error = NULL
       FROM candidates
       WHERE event.id = candidates.id
       RETURNING event.id, event.project_id, event.event_id, event.type,
                 event.event_timestamp, event.environment, event.release, event.platform,
                 event.payload, event.processing_attempts`,
      [limit, staleAfterMs],
    );
    return result.rows.map(toClaimedEvent);
  }

  async complete(event: ClaimedEvent, analysis: EventAnalysis): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (analysis?.type === "error") await upsertErrorGroup(client, event, analysis);
      if (analysis?.type === "metric") await upsertMetricBucket(client, event, analysis);
      await client.query(
        `UPDATE events
         SET processing_status = 'processed', processed_at = now(),
             processing_started_at = NULL, processing_error = NULL,
             error_fingerprint = $2
         WHERE id = $1 AND processing_status = 'processing'`,
        [event.id, analysis?.type === "error" ? analysis.fingerprint : null],
      );
      await client.query("DELETE FROM processor_failures WHERE event_row_id = $1", [event.id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async recordFailure(event: ClaimedEvent, error: unknown, maxAttempts: number): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const terminal = event.processingAttempts >= maxAttempts;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE events
         SET processing_status = $2, processing_started_at = NULL, processing_error = $3
         WHERE id = $1`,
        [event.id, terminal ? "failed" : "pending", message.slice(0, 2_000)],
      );
      await client.query(
        `INSERT INTO processor_failures (event_row_id, attempts, error_message)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_row_id) DO UPDATE SET
           attempts = EXCLUDED.attempts,
           error_message = EXCLUDED.error_message,
           last_failed_at = now()`,
        [event.id, event.processingAttempts, message.slice(0, 2_000)],
      );
      await client.query("COMMIT");
    } catch (recordError) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw recordError;
    } finally {
      client.release();
    }
  }
}

async function upsertErrorGroup(
  client: PoolClient,
  event: ClaimedEvent,
  analysis: NonNullable<EventAnalysis> & { type: "error" },
): Promise<void> {
  await client.query(
    `INSERT INTO error_groups (
       project_id, environment, release, platform, fingerprint, kind, title, culprit,
       first_seen, last_seen, event_count, latest_event_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, 1, $10)
     ON CONFLICT (project_id, environment, release, platform, fingerprint) DO UPDATE SET
       kind = EXCLUDED.kind,
       title = EXCLUDED.title,
       culprit = EXCLUDED.culprit,
       first_seen = LEAST(error_groups.first_seen, EXCLUDED.first_seen),
       last_seen = GREATEST(error_groups.last_seen, EXCLUDED.last_seen),
       event_count = error_groups.event_count + 1,
       latest_event_id = CASE
         WHEN EXCLUDED.last_seen >= error_groups.last_seen THEN EXCLUDED.latest_event_id
         ELSE error_groups.latest_event_id
       END,
       updated_at = now()`,
    [
      event.projectId,
      event.environment,
      event.release ?? "",
      event.platform,
      analysis.fingerprint,
      analysis.kind,
      analysis.title,
      analysis.culprit,
      event.eventTimestamp,
      event.id,
    ],
  );
}

async function upsertMetricBucket(
  client: PoolClient,
  event: ClaimedEvent,
  analysis: NonNullable<EventAnalysis> & { type: "metric" },
): Promise<void> {
  await client.query(
    `INSERT INTO metric_buckets_1m (
       project_id, environment, release, platform, metric, rating, bucket_start,
       sample_count, value_sum, value_min, value_max
     ) VALUES ($1, $2, $3, $4, $5, $6, date_trunc('minute', $7::timestamptz), 1, $8, $8, $8)
     ON CONFLICT (project_id, environment, release, platform, metric, rating, bucket_start)
     DO UPDATE SET
       sample_count = metric_buckets_1m.sample_count + 1,
       value_sum = metric_buckets_1m.value_sum + EXCLUDED.value_sum,
       value_min = LEAST(metric_buckets_1m.value_min, EXCLUDED.value_min),
       value_max = GREATEST(metric_buckets_1m.value_max, EXCLUDED.value_max),
       updated_at = now()`,
    [
      event.projectId,
      event.environment,
      event.release ?? "",
      event.platform,
      analysis.metric,
      analysis.rating,
      event.eventTimestamp,
      analysis.value,
    ],
  );
}

function toClaimedEvent(row: ClaimedRow): ClaimedEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    eventId: row.event_id,
    type: row.type,
    eventTimestamp: row.event_timestamp,
    environment: row.environment,
    release: row.release,
    platform: row.platform,
    payload: row.payload,
    processingAttempts: row.processing_attempts,
  };
}
