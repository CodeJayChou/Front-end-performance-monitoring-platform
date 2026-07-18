# Local MVP Development

## 1. Install and verify

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 2. Start PostgreSQL

```bash
pnpm mvp:db:up
```

The Compose file applies the MVP migrations and creates:

- project: `demo-project`
- public SDK key: `demo-public-key`
- allowed origin: `http://localhost:5173`

## 3. Start services

```bash
pnpm --filter @monitor/ingest-gateway dev
pnpm --filter @monitor/demo-web dev:browser
```

Gateway endpoints:

- `GET http://localhost:3001/health`
- `GET http://localhost:3001/ready`
- `POST http://localhost:3001/api/v1/events/batch`

## 4. Stop database

```bash
pnpm mvp:db:down
```

Removing the named PostgreSQL volume is intentionally not part of the default command because it destroys local event data.
