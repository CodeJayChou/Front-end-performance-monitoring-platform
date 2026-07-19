# Local MVP Development

## 1. Install and verify

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 2. Start the complete stack

```bash
pnpm mvp:up
```

Compose starts PostgreSQL, applies all migrations, loads the demo seed, then starts the ingest gateway, processor and query service.

Demo credentials:

- project: `demo-project`
- public ingest key: `demo-public-key`
- administrative query key: `demo-admin-key`
- allowed browser Origin: `http://localhost:5173`

Service endpoints:

- ingest health: `GET http://localhost:3001/health`
- ingest readiness: `GET http://localhost:3001/ready`
- event ingest: `POST http://localhost:3001/api/v1/events/batch`
- query health: `GET http://localhost:3002/health`
- query readiness: `GET http://localhost:3002/ready`
- dashboard: `http://localhost:5174`

Start the browser demo separately:

```bash
pnpm --filter @monitor/demo-web dev:browser
```

The browser demo sends one page-load event automatically after initialization;
the buttons can then generate error, network, resource and custom events. The
Node demo uses the same ingest endpoint and explicitly flushes before exiting:

```powershell
pnpm --filter @monitor/demo-web dev
```

Open `http://localhost:5174`, then connect with:

- Query API: `http://localhost:3002`
- project: `demo-project`
- administrative query key: `demo-admin-key`

The Dashboard stores the administrative key in `sessionStorage` only. This is
appropriate for the local MVP; production deployment requires real user
authentication or a backend-for-frontend and must not expose an administrative
key in browser assets.

## 3. Database-only workflow

```bash
pnpm mvp:db:up
pnpm --filter @monitor/ingest-gateway db:migrate
pnpm --filter @monitor/ingest-gateway dev
pnpm --filter @monitor/processor-worker dev
pnpm --filter @monitor/query-service dev
```

To execute the real PostgreSQL integration test against that database:

```bash
TEST_DATABASE_URL=postgres://monitor:monitor@localhost:5432/monitor pnpm test:mvp:integration
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL = "postgres://monitor:monitor@localhost:5432/monitor"
pnpm test:mvp:integration
```

## 4. Stop services

```bash
pnpm mvp:down
```

The default down command preserves the named PostgreSQL volume. Removing the volume is intentionally not automated because it destroys local monitoring data.
