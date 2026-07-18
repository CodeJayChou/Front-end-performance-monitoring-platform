import type { Pool, PoolClient } from "pg";
import type { ValidatedEvent } from "../types";

export class EventRepository {
  constructor(private readonly pool: Pool) {}

  async insertBatch(events: ValidatedEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const client = await this.pool.connect();
    let inserted = 0;
    try {
      await client.query("BEGIN");
      for (const event of events) {
        const result = await insertOne(client, event);
        inserted += result.rowCount ?? 0;
      }
      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function insertOne(client: PoolClient, event: ValidatedEvent) {
  return client.query(
    `INSERT INTO events (
       project_id, event_id, schema_version, type, event_timestamp,
       session_id, environment, release, trace, context, payload
     ) VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8, $9, $10, $11)
     ON CONFLICT (project_id, event_id) DO NOTHING`,
    [
      event.projectId,
      event.id,
      event.schemaVersion,
      event.type,
      event.timestamp,
      event.sessionId,
      event.environment ?? "development",
      event.release ?? null,
      event.trace ?? null,
      event.context,
      event.payload,
    ],
  );
}
