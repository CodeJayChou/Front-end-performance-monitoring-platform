# MVP Architecture

## End-to-end flow

```text
demo-web → sdk-web → BatchHttpTransport → ingest-gateway → events
                                                           ↓
                                                   processor-worker
                                                   ├─ error_groups
                                                   └─ metric_buckets_1m
                                                           ↓
                                                    query-service
```

## SDK flow

```text
Integration → Client.capture → validation → Scope/Trace
            → normalize → context → privacy
            → filter → stable sampling → deduplication → rate limiting
            → beforeSend → BatchHttpTransport
```

The transport captures the original fetch function before Web integrations patch it. The SDK endpoint is also added to Fetch/XHR ignore lists, preventing recursive self-monitoring.

## Ingest flow

`POST /api/v1/events/batch` performs request limits, project/public SDK Key authorization, Origin allowlisting, Event Contract v1 validation and transactional idempotent inserts. The public SDK Key grants write-only ingest access.

## Processing flow

The processor claims pending or stale events with `FOR UPDATE SKIP LOCKED`. This allows multiple worker instances without a separate queue. Each event is completed in its own transaction:

- error events receive a SHA-256 fingerprint based on kind, normalized title and culprit;
- Web Vitals are aggregated into one-minute rating buckets;
- performance buckets retain the `context.tags.scenario` dimension, without
  overloading the release field;
- query responses calculate P75 from processed raw performance events while
  retaining bucket averages, minimums and maximums for diagnostics;
- INP reports live changes and, after the first interaction, emits the current
  page-session value once per minute for long-lived-page time series;
- the aggregate update and `processed` state are committed atomically;
- failures return to `pending` until the configured maximum attempt count, then become `failed`;
- stale `processing` events are reclaimed after a timeout.

PostgreSQL remains the MVP queue and analytics store. Kafka or ClickHouse should only be introduced after measured volume or query latency requires them.

The Web batch transport retries transient failures, puts an exhausted batch
back at the front of its in-memory queue, and flushes on page hide. A
transactional retention command removes expired raw events, inactive error
groups and minute buckets.

## Query and trust boundaries

The query service uses a project-scoped administrative Bearer Key. It never accepts the public SDK Key. All repository queries require `project_id` and support bounded time ranges. Default range is 24 hours; maximum range is 31 days.
