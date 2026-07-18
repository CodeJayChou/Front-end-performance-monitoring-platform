# MVP Architecture

## Scope

The first vertical slice is deliberately small:

```text
demo-web → sdk-web → BatchHttpTransport → ingest-gateway → PostgreSQL
```

Kafka, ClickHouse, Replay, alerts, React/Vue adapters and RBAC are deferred until this path is stable.

## SDK flow

```text
Integration → Client.capture → validate → Scope/Trace
            → normalize → context → privacy
            → filter → stable sample → dedup → rateLimit
            → beforeSend → BatchHttpTransport
```

`BatchHttpTransport` captures the unpatched fetch function before Web integrations are installed. The configured DSN is therefore not observed by `FetchIntegration`, preventing recursive self-monitoring.

## Ingest flow

```text
POST /api/v1/events/batch
  → request/batch limits
  → project + public SDK key lookup
  → origin allowlist
  → schema and per-event validation
  → transactional idempotent insert
  → 202 Accepted
```

The public SDK key identifies an ingest project; it is not an administrative secret.
