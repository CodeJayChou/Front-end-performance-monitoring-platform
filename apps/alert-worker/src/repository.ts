import type { Pool, PoolClient } from "pg";
import { decideState } from "./evaluate";
import type {
  AlertRule,
  AlertState,
  ClaimedDelivery,
  EvaluationWindow,
  StateDecision,
} from "./types";

interface RuleRow {
  id: string;
  project_id: string;
  name: string;
  type: AlertRule["type"];
  metric: string | null;
  threshold: number;
  window_minutes: number;
  consecutive_periods: number;
  cooldown_minutes: number;
  environment: string | null;
  release: string | null;
  platform: string | null;
  webhook_url: string | null;
}

interface StateRow {
  status: AlertState["status"];
  consecutive_breaches: number;
  last_evaluated_at: Date | null;
  last_triggered_at: Date | null;
  current_incident_id: string | null;
}

export class AlertRepository {
  constructor(private readonly pool: Pool) {}

  async listEnabledRules(): Promise<AlertRule[]> {
    const result = await this.pool.query<RuleRow>(
      `SELECT id, project_id, name, type, metric, threshold, window_minutes,
              consecutive_periods, cooldown_minutes, environment, release, platform, webhook_url
       FROM alert_rules
       WHERE enabled = true
       ORDER BY id`,
    );
    return result.rows.map(toRule);
  }

  async evaluateValue(rule: AlertRule, window: EvaluationWindow): Promise<number> {
    const values: unknown[] = [rule.projectId, window.start, window.end];
    let filters = "project_id = $1 AND event_timestamp >= $2 AND event_timestamp < $3";
    if (rule.environment) filters += clause(values, "environment", rule.environment);
    if (rule.release) filters += clause(values, "release", rule.release);
    if (rule.platform) filters += clause(values, "platform", rule.platform);

    if (rule.type === "error_count") {
      const result = await this.pool.query<{ value: string }>(
        `SELECT count(*)::text AS value
         FROM events
         WHERE ${filters} AND type = 'error' AND processing_status = 'processed'`,
        values,
      );
      return Number(result.rows[0]?.value ?? 0);
    }

    values.push(rule.metric);
    const result = await this.pool.query<{ value: number | null }>(
      `SELECT percentile_cont(0.75) WITHIN GROUP (
                ORDER BY (payload->>'value')::double precision
              ) AS value
       FROM events
       WHERE ${filters}
         AND type = 'performance'
         AND processing_status = 'processed'
         AND payload->>'metric' = $${values.length}
         AND jsonb_typeof(payload->'value') = 'number'`,
      values,
    );
    return Number(result.rows[0]?.value ?? 0);
  }

  async recordEvaluation(
    rule: AlertRule,
    window: EvaluationWindow,
    value: number,
    breached: boolean,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO alert_rule_states (rule_id) VALUES ($1)
         ON CONFLICT (rule_id) DO NOTHING`,
        [rule.id],
      );
      const result = await client.query<StateRow>(
        `SELECT status, consecutive_breaches, last_evaluated_at,
                last_triggered_at, current_incident_id
         FROM alert_rule_states WHERE rule_id = $1 FOR UPDATE`,
        [rule.id],
      );
      const row = result.rows[0]!;
      if (row.last_evaluated_at && row.last_evaluated_at >= window.end) {
        await client.query("COMMIT");
        return false;
      }

      const state: AlertState = {
        status: row.status,
        consecutiveBreaches: row.consecutive_breaches,
        lastEvaluatedAt: row.last_evaluated_at,
        lastTriggeredAt: row.last_triggered_at,
        currentIncidentId: row.current_incident_id,
      };
      const decision = decideState(rule, state, breached, window.end);
      const incidentId = await applyTransition(client, rule, state, decision, window, value);
      await client.query(
        `UPDATE alert_rule_states
         SET status = $2, consecutive_breaches = $3, last_value = $4,
             last_evaluated_at = $5,
             last_triggered_at = CASE WHEN $6 = 'triggered' THEN $5 ELSE last_triggered_at END,
             current_incident_id = $7, updated_at = now()
         WHERE rule_id = $1`,
        [
          rule.id,
          decision.status,
          decision.consecutiveBreaches,
          value,
          window.end,
          decision.transition,
          decision.status === "firing" ? incidentId : null,
        ],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async claimDeliveries(limit: number, staleAfterMs: number): Promise<ClaimedDelivery[]> {
    const result = await this.pool.query<{
      id: string;
      webhook_url: string;
      payload: unknown;
      attempts: number;
    }>(
      `WITH candidates AS (
         SELECT id FROM alert_deliveries
         WHERE (status IN ('pending', 'retrying') AND next_attempt_at <= now())
            OR (status = 'sending' AND last_attempt_at < now() - ($2 * interval '1 millisecond'))
         ORDER BY next_attempt_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE alert_deliveries AS delivery
       SET status = 'sending', attempts = attempts + 1,
           last_attempt_at = now(), updated_at = now()
       FROM candidates
       WHERE delivery.id = candidates.id
       RETURNING delivery.id, delivery.webhook_url, delivery.payload, delivery.attempts`,
      [limit, staleAfterMs],
    );
    return result.rows.map((row) => ({
      id: row.id,
      webhookUrl: row.webhook_url,
      payload: row.payload,
      attempts: row.attempts,
    }));
  }

  async markDelivered(id: string, responseStatus: number): Promise<void> {
    await this.pool.query(
      `UPDATE alert_deliveries
       SET status = 'delivered', delivered_at = now(), response_status = $2,
           last_error = NULL, updated_at = now()
       WHERE id = $1 AND status = 'sending'`,
      [id, responseStatus],
    );
  }

  async markDeliveryFailure(
    delivery: ClaimedDelivery,
    error: unknown,
    maxAttempts: number,
  ): Promise<void> {
    const terminal = delivery.attempts >= maxAttempts;
    const delayMs = Math.min(60_000, 1_000 * 2 ** Math.max(0, delivery.attempts - 1));
    const message = error instanceof Error ? error.message : String(error);
    await this.pool.query(
      `UPDATE alert_deliveries
       SET status = $2,
           next_attempt_at = CASE WHEN $2 = 'retrying'
             THEN now() + ($3 * interval '1 millisecond') ELSE next_attempt_at END,
           last_error = $4, updated_at = now()
       WHERE id = $1 AND status = 'sending'`,
      [delivery.id, terminal ? "failed" : "retrying", delayMs, message.slice(0, 2_000)],
    );
  }
}

async function applyTransition(
  client: PoolClient,
  rule: AlertRule,
  state: AlertState,
  decision: StateDecision,
  window: EvaluationWindow,
  value: number,
): Promise<string | null> {
  if (decision.transition === "triggered") {
    const result = await client.query<{ id: string }>(
      `INSERT INTO alert_incidents (
         project_id, rule_id, status, started_at, trigger_value, last_value, window_start, window_end
       ) VALUES ($1, $2, 'firing', $3, $4, $4, $5, $3)
       RETURNING id`,
      [rule.projectId, rule.id, window.end, value, window.start],
    );
    const incidentId = result.rows[0]!.id;
    await enqueueDelivery(client, rule, incidentId, "triggered", window, value);
    return incidentId;
  }

  const incidentId = state.currentIncidentId;
  if (incidentId) {
    await client.query(
      `UPDATE alert_incidents
       SET status = $2, last_value = $3, window_start = $4, window_end = $5,
           resolved_at = CASE WHEN $2 = 'resolved' THEN $5 ELSE resolved_at END,
           updated_at = now()
       WHERE id = $1`,
      [incidentId, decision.status === "firing" ? "firing" : "resolved", value, window.start, window.end],
    );
    if (decision.transition === "resolved") {
      await enqueueDelivery(client, rule, incidentId, "resolved", window, value);
    }
  }
  return decision.status === "firing" ? incidentId : null;
}

async function enqueueDelivery(
  client: PoolClient,
  rule: AlertRule,
  incidentId: string,
  eventKind: "triggered" | "resolved",
  window: EvaluationWindow,
  value: number,
): Promise<void> {
  if (!rule.webhookUrl) return;
  const payload = {
    version: "1",
    event: `alert.${eventKind}`,
    projectId: rule.projectId,
    incidentId,
    rule: { id: rule.id, name: rule.name, type: rule.type, metric: rule.metric },
    value,
    threshold: rule.threshold,
    window: { start: window.start.toISOString(), end: window.end.toISOString() },
  };
  await client.query(
    `INSERT INTO alert_deliveries (
       project_id, rule_id, incident_id, event_kind, webhook_url, payload
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (incident_id, event_kind) DO NOTHING`,
    [rule.projectId, rule.id, incidentId, eventKind, rule.webhookUrl, payload],
  );
}

function clause(values: unknown[], column: string, value: unknown): string {
  const index = values.push(value);
  return ` AND ${column} = $${index}`;
}

function toRule(row: RuleRow): AlertRule {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    metric: row.metric,
    threshold: Number(row.threshold),
    windowMinutes: row.window_minutes,
    consecutivePeriods: row.consecutive_periods,
    cooldownMinutes: row.cooldown_minutes,
    environment: row.environment,
    release: row.release,
    platform: row.platform,
    webhookUrl: row.webhook_url,
  };
}
