CREATE TABLE IF NOT EXISTS alert_rules (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('error_count', 'performance_p75')),
  metric TEXT CHECK (metric IS NULL OR metric IN ('FP', 'FCP', 'LCP', 'CLS', 'INP', 'TTFB')),
  threshold DOUBLE PRECISION NOT NULL CHECK (threshold >= 0),
  window_minutes INTEGER NOT NULL DEFAULT 5 CHECK (window_minutes BETWEEN 1 AND 1440),
  consecutive_periods INTEGER NOT NULL DEFAULT 1 CHECK (consecutive_periods BETWEEN 1 AND 10),
  cooldown_minutes INTEGER NOT NULL DEFAULT 15 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
  environment TEXT,
  release TEXT,
  platform TEXT,
  webhook_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (type = 'error_count' AND metric IS NULL) OR
    (type = 'performance_p75' AND metric IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS alert_rules_project_idx
  ON alert_rules(project_id, enabled, id);

CREATE TABLE IF NOT EXISTS alert_incidents (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('firing', 'resolved')),
  started_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  trigger_value DOUBLE PRECISION NOT NULL,
  last_value DOUBLE PRECISION NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_incidents_project_started_idx
  ON alert_incidents(project_id, started_at DESC);

CREATE INDEX IF NOT EXISTS alert_incidents_rule_status_idx
  ON alert_incidents(rule_id, status);

CREATE TABLE IF NOT EXISTS alert_rule_states (
  rule_id BIGINT PRIMARY KEY REFERENCES alert_rules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'firing')),
  consecutive_breaches INTEGER NOT NULL DEFAULT 0,
  last_value DOUBLE PRECISION,
  last_evaluated_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  current_incident_id BIGINT REFERENCES alert_incidents(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  incident_id BIGINT NOT NULL REFERENCES alert_incidents(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('triggered', 'resolved')),
  webhook_url TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'retrying', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  response_status INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (incident_id, event_kind)
);

CREATE INDEX IF NOT EXISTS alert_deliveries_queue_idx
  ON alert_deliveries(status, next_attempt_at, id)
  WHERE status IN ('pending', 'retrying', 'sending');
