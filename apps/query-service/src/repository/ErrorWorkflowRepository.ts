import type { Pool } from "pg";
import type { ErrorIssueUpdate } from "../errorWorkflow";

export class ErrorWorkflowRepository {
  constructor(private readonly pool: Pool) {}

  async update(
    projectId: string,
    fingerprint: string,
    input: ErrorIssueUpdate,
  ): Promise<unknown | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query(
        `SELECT 1 FROM error_groups
         WHERE project_id = $1 AND fingerprint = $2 LIMIT 1`,
        [projectId, fingerprint],
      );
      if (!exists.rowCount) {
        await client.query("COMMIT");
        return null;
      }
      await client.query(
        `INSERT INTO error_issues (project_id, fingerprint)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [projectId, fingerprint],
      );
      const currentResult = await client.query<{ status: string; note: string | null }>(
        `SELECT status, note FROM error_issues
         WHERE project_id = $1 AND fingerprint = $2 FOR UPDATE`,
        [projectId, fingerprint],
      );
      const current = currentResult.rows[0]!;
      const result = await client.query(
        `UPDATE error_issues
         SET status = $3, note = $4,
             resolved_at = CASE WHEN $3 = 'resolved' THEN COALESCE(resolved_at, now()) ELSE NULL END,
             updated_at = now()
         WHERE project_id = $1 AND fingerprint = $2
         RETURNING *`,
        [projectId, fingerprint, input.status, input.note],
      );
      if (current.status !== input.status) {
        await client.query(
          `INSERT INTO error_issue_history (
             project_id, fingerprint, action, from_status, to_status, note
           ) VALUES ($1, $2, 'status_changed', $3, $4, $5)`,
          [projectId, fingerprint, current.status, input.status, input.note],
        );
      } else if (current.note !== input.note) {
        await client.query(
          `INSERT INTO error_issue_history (
             project_id, fingerprint, action, from_status, to_status, note
           ) VALUES ($1, $2, 'note_changed', $3, $3, $4)`,
          [projectId, fingerprint, current.status, input.note],
        );
      }
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
