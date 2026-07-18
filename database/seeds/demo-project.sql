INSERT INTO projects (id, name, status, allowed_origins)
VALUES ('demo-project', 'MVP Demo Project', 'active', '["http://localhost:5173"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  allowed_origins = EXCLUDED.allowed_origins;

INSERT INTO project_keys (project_id, public_key, status)
VALUES ('demo-project', 'demo-public-key', 'active')
ON CONFLICT (public_key) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  status = EXCLUDED.status;
