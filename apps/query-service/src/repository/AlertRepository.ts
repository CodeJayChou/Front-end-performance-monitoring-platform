import type { Pool } from "pg";
import type { CreateAlertRuleInput } from "../alerts";
import type { QueryFilters } from "../filters";

export class AlertRepository {
  constructor(private readonly pool: Pool) {}

  async listRules(projectId: string): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT rule.id, rule.name, rule.type, rule.metric, rule.threshold,
              rule.window_minutes, rule.consecutive_periods, rule.cooldown_minutes,
              rule.environment, rule.release, rule.platform, rule.webhook_url,
              rule.enabled, rule.created_at, rule.updated_at,
              COALESCE(state.status, 'ok') AS status,
              COALESCE(state.consecutive_breaches, 0) AS consecutive_breaches,
              state.last_value, state.last_evaluated_at, state.last_triggered_at
       FROM alert_rules AS rule
       LEFT JOIN alert_rule_states AS state ON state.rule_id = rule.id
       WHERE rule.project_id = $1
       ORDER BY rule.created_at DESC, rule.id DESC`,
      [projectId],
    );
    return result.rows;
  }

  async createRule(projectId: string, input: CreateAlertRuleInput): Promise<unknown> {
    const result = await this.pool.query(
      `INSERT INTO alert_rules (
         project_id, name, type, metric, threshold, window_minutes,
         consecutive_periods, cooldown_minutes, environment, release,
         platform, webhook_url, enabled
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        projectId, input.name, input.type, input.metric, input.threshold,
        input.windowMinutes, input.consecutivePeriods, input.cooldownMinutes,
        input.environment, input.release, input.platform, input.webhookUrl, input.enabled,
      ],
    );
    return result.rows[0];
  }

  async setEnabled(projectId: string, ruleId: string, enabled: boolean): Promise<unknown | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        id: string;
        name: string;
        type: string;
        metric: string | null;
        threshold: number;
        webhook_url: string | null;
        [key: string]: unknown;
      }>(
        `UPDATE alert_rules SET enabled = $3, updated_at = now()
         WHERE project_id = $1 AND id = $2
         RETURNING *`,
        [projectId, ruleId, enabled],
      );
      const rule = result.rows[0];
      if (!rule) {
        await client.query("COMMIT");
        return null;
      }
      if (!enabled) {
        const state = await client.query<{
          current_incident_id: string | null;
          last_value: number | null;
        }>(
          `SELECT current_incident_id, last_value
           FROM alert_rule_states WHERE rule_id = $1 FOR UPDATE`,
          [ruleId],
        );
        const current = state.rows[0];
        if (current?.current_incident_id) {
          await client.query(
            `UPDATE alert_incidents
             SET status = 'resolved', resolved_at = now(), updated_at = now()
             WHERE id = $1 AND status = 'firing'`,
            [current.current_incident_id],
          );
          if (rule.webhook_url) {
            const payload = {
              version: "1",
              event: "alert.resolved",
              reason: "rule_disabled",
              projectId,
              incidentId: current.current_incident_id,
              rule: { id: rule.id, name: rule.name, type: rule.type, metric: rule.metric },
              value: current.last_value,
              threshold: Number(rule.threshold),
            };
            await client.query(
              `INSERT INTO alert_deliveries (
                 project_id, rule_id, incident_id, event_kind, webhook_url, payload
               ) VALUES ($1, $2, $3, 'resolved', $4, $5)
               ON CONFLICT (incident_id, event_kind) DO NOTHING`,
              [projectId, ruleId, current.current_incident_id, rule.webhook_url, payload],
            );
          }
        }
        await client.query(
          `UPDATE alert_rule_states
           SET status = 'ok', consecutive_breaches = 0,
               current_incident_id = NULL, updated_at = now()
           WHERE rule_id = $1`,
          [ruleId],
        );
      }
      await client.query("COMMIT");
      return rule;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteRule(projectId: string, ruleId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM alert_rules WHERE project_id = $1 AND id = $2",
      [projectId, ruleId],
    );
    return result.rowCount === 1;
  }

  async incidents(projectId: string, filters: QueryFilters): Promise<unknown> {
    const values: unknown[] = [projectId, filters.from, filters.to];
    let clause = "incident.project_id = $1 AND incident.started_at >= $2 AND incident.started_at < $3";
    if (filters.environment) clause += add(values, "rule.environment", filters.environment);
    if (filters.release) clause += add(values, "rule.release", filters.release);
    if (filters.platform) clause += add(values, "rule.platform", filters.platform);
    const count = await this.pool.query(
      `SELECT count(*)::text AS total
       FROM alert_incidents AS incident
       JOIN alert_rules AS rule ON rule.id = incident.rule_id
       WHERE ${clause}`,
      values,
    );
    const limitIndex = values.push(filters.limit);
    const offsetIndex = values.push(filters.offset);
    const result = await this.pool.query(
      `SELECT incident.id, incident.status, incident.started_at, incident.resolved_at,
              incident.trigger_value, incident.last_value, incident.window_start, incident.window_end,
              rule.id AS rule_id, rule.name AS rule_name, rule.type AS rule_type,
              rule.metric, rule.threshold
       FROM alert_incidents AS incident
       JOIN alert_rules AS rule ON rule.id = incident.rule_id
       WHERE ${clause}
       ORDER BY incident.started_at DESC, incident.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );
    return { total: count.rows[0]?.total ?? "0", items: result.rows };
  }
}

function add(values: unknown[], column: string, value: unknown): string {
  const index = values.push(value);
  return ` AND ${column} = $${index}`;
}
