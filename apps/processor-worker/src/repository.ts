import type { Pool, PoolClient } from "pg";
import { SourceMapSymbolicator } from "./symbolicate";
import type { ClaimedEvent, EventAnalysis, SymbolicationResult } from "./types";

interface ClaimedRow {
  id: string;
  project_id: string;
  event_id: string;
  type: string;
  event_timestamp: Date;
  environment: string;
  release: string | null;
  platform: string;
  context: unknown;
  payload: unknown;
  processing_attempts: number;
}

export class ProcessorRepository {
  private readonly symbolicator: SourceMapSymbolicator;

  constructor(private readonly pool: Pool) {
    this.symbolicator = new SourceMapSymbolicator(pool);
  }

  symbolicate(event: ClaimedEvent): Promise<SymbolicationResult> {
    return this.symbolicator.symbolicate(event);
  }

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
                 event.context, event.payload, event.processing_attempts`,
      [limit, staleAfterMs],
    );
    return result.rows.map(toClaimedEvent);
  }

  async complete(
    event: ClaimedEvent,
    analysis: EventAnalysis,
    symbolication: SymbolicationResult = { status: "not_attempted", stack: null },
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (analysis?.type === "error") {
        await upsertErrorGroup(client, event, analysis, symbolication);
        await upsertErrorIssue(client, event, analysis.fingerprint);
      }
      if (analysis?.type === "metric") await upsertMetricBucket(client, event, analysis);
      await client.query(
        `UPDATE events
         SET processing_status = 'processed', processed_at = now(),
             processing_started_at = NULL, processing_error = NULL,
             error_fingerprint = $2, symbolication_status = $3,
             symbolicated_stack = $4
         WHERE id = $1 AND processing_status = 'processing'`,
        [
          event.id,
          analysis?.type === "error" ? analysis.fingerprint : null,
          symbolication.status,
          symbolication.stack ? JSON.stringify(symbolication.stack) : null,
        ],
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
  symbolication: SymbolicationResult,
): Promise<void> {
  const originalCulprit = symbolication.stack?.find((frame) => frame.inApp) ?? symbolication.stack?.[0];
  const culprit = originalCulprit
    ? `${originalCulprit.originalFile}:${originalCulprit.originalLine}:${originalCulprit.originalFunctionName ?? "anonymous"}`.slice(0, 1_000)
    : analysis.culprit;
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
      culprit,
      event.eventTimestamp,
      event.id,
    ],
  );
}

async function upsertErrorIssue(
  client: PoolClient,
  event: ClaimedEvent,
  fingerprint: string,
): Promise<void> {
  const inserted = await client.query(
    `INSERT INTO error_issues (project_id, fingerprint)
     VALUES ($1, $2)
     ON CONFLICT (project_id, fingerprint) DO NOTHING`,
    [event.projectId, fingerprint],
  );
  if (inserted.rowCount === 1) {
    await client.query(
      `INSERT INTO error_issue_history (project_id, fingerprint, action, to_status)
       VALUES ($1, $2, 'created', 'unresolved')`,
      [event.projectId, fingerprint],
    );
  }

  const issue = await client.query<{ status: string; resolved_at: Date | null }>(
    `SELECT status, resolved_at FROM error_issues
     WHERE project_id = $1 AND fingerprint = $2 FOR UPDATE`,
    [event.projectId, fingerprint],
  );
  const current = issue.rows[0];
  if (
    current?.status === "resolved" &&
    current.resolved_at &&
    event.eventTimestamp > current.resolved_at
  ) {
    await client.query(
      `UPDATE error_issues
       SET status = 'unresolved', resolved_at = NULL,
           last_regressed_at = $3, regression_count = regression_count + 1,
           updated_at = now()
       WHERE project_id = $1 AND fingerprint = $2`,
      [event.projectId, fingerprint, event.eventTimestamp],
    );
    await client.query(
      `INSERT INTO error_issue_history (
         project_id, fingerprint, action, from_status, to_status, note, created_at
       ) VALUES ($1, $2, 'regressed', 'resolved', 'unresolved', '检测到解决后的新事件', $3)`,
      [event.projectId, fingerprint, event.eventTimestamp],
    );
  }
}

async function upsertMetricBucket(
  client: PoolClient,
  event: ClaimedEvent,
  analysis: NonNullable<EventAnalysis> & { type: "metric" },
): Promise<void> {
  await client.query(
    `INSERT INTO metric_buckets_1m (
       project_id, environment, release, platform, scenario, metric, rating, bucket_start,
       sample_count, value_sum, value_min, value_max
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, date_trunc('minute', $8::timestamptz), 1, $9, $9, $9)
     ON CONFLICT (project_id, environment, release, platform, scenario, metric, rating, bucket_start)
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
      scenarioFromContext(event.context),
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
    context: row.context,
    payload: row.payload,
    processingAttempts: row.processing_attempts,
  };
}

function scenarioFromContext(value: unknown): string {
  if (!value || typeof value !== "object") return "default";
  const tags = (value as Record<string, unknown>).tags;
  if (!tags || typeof tags !== "object") return "default";
  const scenario = (tags as Record<string, unknown>).scenario;
  return typeof scenario === "string" && scenario.length > 0 ? scenario : "default";
}
