import type { Pool } from "pg";
import type { QueryFilters } from "../filters";

interface SqlFilter {
  clause: string;
  values: unknown[];
}

export class QueryRepository {
  constructor(private readonly pool: Pool) {}

  async overview(projectId: string, filters: QueryFilters): Promise<unknown> {
    const events = eventFilter(projectId, filters);
    const metrics = aggregateFilter(projectId, filters);
    const [eventResult, metricResult] = await Promise.all([
      this.pool.query(
        `SELECT count(*)::text AS total_events,
                count(*) FILTER (WHERE type = 'error')::text AS error_events,
                count(DISTINCT session_id)::text AS sessions,
                count(*) FILTER (WHERE processing_status = 'failed')::text AS failed_events
         FROM events
         WHERE ${events.clause}`,
        events.values,
      ),
      this.pool.query(
        `SELECT metric,
                sum(sample_count)::text AS sample_count,
                CASE WHEN sum(sample_count) = 0 THEN NULL
                     ELSE sum(value_sum) / sum(sample_count) END AS average,
                sum(sample_count) FILTER (WHERE rating = 'good')::text AS good,
                sum(sample_count) FILTER (WHERE rating = 'needs-improvement')::text AS needs_improvement,
                sum(sample_count) FILTER (WHERE rating = 'poor')::text AS poor
         FROM metric_buckets_1m
         WHERE ${metrics.clause}
         GROUP BY metric
         ORDER BY metric`,
        metrics.values,
      ),
    ]);
    return { ...eventResult.rows[0], vitals: metricResult.rows };
  }

  async performanceSeries(
    projectId: string,
    filters: QueryFilters,
    metric?: string,
  ): Promise<unknown[]> {
    const sql = aggregateFilter(projectId, filters);
    if (metric) addClause(sql, "metric", metric);
    const result = await this.pool.query(
      `SELECT bucket_start, metric, rating,
              sum(sample_count)::text AS sample_count,
              sum(value_sum) / sum(sample_count) AS average,
              min(value_min) AS minimum,
              max(value_max) AS maximum
       FROM metric_buckets_1m
       WHERE ${sql.clause}
       GROUP BY bucket_start, metric, rating
       ORDER BY bucket_start ASC, metric, rating`,
      sql.values,
    );
    return result.rows;
  }

  async errors(projectId: string, filters: QueryFilters): Promise<unknown> {
    const sql = groupFilter(projectId, filters);
    const countValues = [...sql.values];
    const count = await this.pool.query(
      `SELECT count(DISTINCT fingerprint)::text AS total
       FROM error_groups WHERE ${sql.clause}`,
      countValues,
    );
    const limitIndex = sql.values.push(filters.limit);
    const offsetIndex = sql.values.push(filters.offset);
    const result = await this.pool.query(
      `SELECT fingerprint, max(kind) AS kind, max(title) AS title,
              max(culprit) AS culprit, min(first_seen) AS first_seen,
              max(last_seen) AS last_seen, sum(event_count)::text AS event_count,
              array_agg(DISTINCT environment) AS environments,
              array_remove(array_agg(DISTINCT NULLIF(release, '')), NULL) AS releases,
              array_agg(DISTINCT platform) AS platforms
       FROM error_groups
       WHERE ${sql.clause}
       GROUP BY fingerprint
       ORDER BY last_seen DESC, fingerprint
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      sql.values,
    );
    return { total: count.rows[0]?.total ?? "0", items: result.rows };
  }

  async errorDetail(
    projectId: string,
    fingerprint: string,
    filters: QueryFilters,
  ): Promise<unknown | null> {
    const groups = groupFilter(projectId, filters);
    addClause(groups, "fingerprint", fingerprint);
    const group = await this.pool.query(
      `SELECT fingerprint, max(kind) AS kind, max(title) AS title,
              max(culprit) AS culprit, min(first_seen) AS first_seen,
              max(last_seen) AS last_seen, sum(event_count)::text AS event_count,
              array_agg(DISTINCT environment) AS environments,
              array_remove(array_agg(DISTINCT NULLIF(release, '')), NULL) AS releases,
              array_agg(DISTINCT platform) AS platforms
       FROM error_groups WHERE ${groups.clause}
       GROUP BY fingerprint`,
      groups.values,
    );
    if (!group.rows[0]) return null;

    const events = eventFilter(projectId, filters);
    addClause(events, "error_fingerprint", fingerprint);
    const limitIndex = events.values.push(filters.limit);
    const offsetIndex = events.values.push(filters.offset);
    const samples = await this.pool.query(
      `SELECT event_id, event_timestamp, session_id, environment, release,
              platform, context, payload
       FROM events WHERE ${events.clause}
       ORDER BY event_timestamp DESC, id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      events.values,
    );
    return { group: group.rows[0], events: samples.rows };
  }

  async events(projectId: string, filters: QueryFilters): Promise<unknown> {
    const sql = eventFilter(projectId, filters);
    const count = await this.pool.query(
      `SELECT count(*)::text AS total FROM events WHERE ${sql.clause}`,
      [...sql.values],
    );
    const limitIndex = sql.values.push(filters.limit);
    const offsetIndex = sql.values.push(filters.offset);
    const result = await this.pool.query(
      `SELECT event_id, schema_version, type, event_timestamp, received_at,
              session_id, environment, release, platform, sdk, trace, context,
              payload, processing_status
       FROM events WHERE ${sql.clause}
       ORDER BY event_timestamp DESC, id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      sql.values,
    );
    return { total: count.rows[0]?.total ?? "0", items: result.rows };
  }

  async releases(projectId: string, filters: QueryFilters): Promise<unknown[]> {
    const sql = eventFilter(projectId, { ...filters, release: undefined });
    const result = await this.pool.query(
      `SELECT release, count(*)::text AS event_count,
              min(event_timestamp) AS first_seen, max(event_timestamp) AS last_seen
       FROM events
       WHERE ${sql.clause} AND release IS NOT NULL
       GROUP BY release
       ORDER BY last_seen DESC`,
      sql.values,
    );
    return result.rows;
  }
}

function eventFilter(projectId: string, filters: QueryFilters): SqlFilter {
  const sql: SqlFilter = {
    clause: "project_id = $1 AND event_timestamp >= $2 AND event_timestamp < $3",
    values: [projectId, filters.from, filters.to],
  };
  addCommonFilters(sql, filters);
  return sql;
}

function aggregateFilter(projectId: string, filters: QueryFilters): SqlFilter {
  const sql: SqlFilter = {
    clause: "project_id = $1 AND bucket_start >= $2 AND bucket_start < $3",
    values: [projectId, filters.from, filters.to],
  };
  addCommonFilters(sql, filters, true);
  return sql;
}

function groupFilter(projectId: string, filters: QueryFilters): SqlFilter {
  const sql: SqlFilter = {
    clause: "project_id = $1 AND last_seen >= $2 AND first_seen < $3",
    values: [projectId, filters.from, filters.to],
  };
  addCommonFilters(sql, filters, true);
  return sql;
}

function addCommonFilters(
  sql: SqlFilter,
  filters: QueryFilters,
  emptyRelease = false,
): void {
  if (filters.environment) addClause(sql, "environment", filters.environment);
  if (filters.release === "(none)") {
    if (emptyRelease) addClause(sql, "release", "");
    else sql.clause += " AND release IS NULL";
  } else if (filters.release) {
    addClause(sql, "release", filters.release);
  }
  if (filters.platform) addClause(sql, "platform", filters.platform);
}

function addClause(sql: SqlFilter, column: string, value: unknown): void {
  const index = sql.values.push(value);
  sql.clause += ` AND ${column} = $${index}`;
}
