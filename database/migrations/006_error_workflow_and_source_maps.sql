CREATE TABLE IF NOT EXISTS source_maps (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  release TEXT NOT NULL,
  dist TEXT NOT NULL DEFAULT '',
  artifact_name TEXT NOT NULL,
  source_map JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, release, dist, artifact_name)
);

CREATE INDEX IF NOT EXISTS source_maps_lookup_idx
  ON source_maps(project_id, release, artifact_name);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS symbolication_status TEXT NOT NULL DEFAULT 'not_attempted',
  ADD COLUMN IF NOT EXISTS symbolicated_stack JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_symbolication_status_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_symbolication_status_check
      CHECK (symbolication_status IN (
        'not_attempted', 'no_stack', 'no_release', 'map_not_found', 'symbolicated', 'failed'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS error_issues (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved'
    CHECK (status IN ('unresolved', 'in_progress', 'resolved', 'ignored')),
  note TEXT,
  resolved_at TIMESTAMPTZ,
  last_regressed_at TIMESTAMPTZ,
  regression_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS error_issues_project_status_idx
  ON error_issues(project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS error_issue_history (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'status_changed', 'regressed', 'note_changed')),
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_issue_history_lookup_idx
  ON error_issue_history(project_id, fingerprint, created_at DESC);
