CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  release TEXT,
  trace JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, event_id)
);

CREATE INDEX IF NOT EXISTS events_project_time_idx
  ON events(project_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS events_project_type_time_idx
  ON events(project_id, type, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS events_project_session_idx
  ON events(project_id, session_id);
