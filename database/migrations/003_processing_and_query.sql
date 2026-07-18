ALTER TABLE events
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS sdk JSONB,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS error_fingerprint TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_processing_status_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_processing_status_check
      CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS events_processing_queue_idx
  ON events(processing_status, received_at, id)
  WHERE processing_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS events_error_fingerprint_idx
  ON events(project_id, error_fingerprint, event_timestamp DESC)
  WHERE error_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS error_groups (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  release TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  culprit TEXT,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  event_count BIGINT NOT NULL DEFAULT 1,
  latest_event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, environment, release, platform, fingerprint)
);

CREATE INDEX IF NOT EXISTS error_groups_project_last_seen_idx
  ON error_groups(project_id, last_seen DESC);

CREATE TABLE IF NOT EXISTS metric_buckets_1m (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  release TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL,
  metric TEXT NOT NULL,
  rating TEXT NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  sample_count BIGINT NOT NULL DEFAULT 0,
  value_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  value_min DOUBLE PRECISION NOT NULL,
  value_max DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, environment, release, platform, metric, rating, bucket_start)
);

CREATE INDEX IF NOT EXISTS metric_buckets_project_time_idx
  ON metric_buckets_1m(project_id, bucket_start DESC);

CREATE TABLE IF NOT EXISTS processor_failures (
  event_row_id BIGINT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL,
  error_message TEXT NOT NULL,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_admin_keys (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  admin_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_admin_keys_project_idx
  ON project_admin_keys(project_id);
