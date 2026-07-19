ALTER TABLE metric_buckets_1m
  ADD COLUMN IF NOT EXISTS scenario TEXT NOT NULL DEFAULT 'default';

UPDATE metric_buckets_1m SET scenario = 'default' WHERE scenario = '';

ALTER TABLE metric_buckets_1m
  DROP CONSTRAINT IF EXISTS metric_buckets_1m_pkey;

ALTER TABLE metric_buckets_1m
  ADD PRIMARY KEY (
    project_id, environment, release, platform, scenario, metric, rating, bucket_start
  );

CREATE INDEX IF NOT EXISTS metric_buckets_project_scenario_time_idx
  ON metric_buckets_1m(project_id, scenario, bucket_start DESC);
