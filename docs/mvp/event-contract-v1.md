# Event Contract v1

Every network event is normalized to schema version `1.0` before transport:

```ts
interface BaseEvent<T> {
  id: string;
  schemaVersion: "1.0";
  type: string;
  timestamp: number;
  projectId: string;
  sessionId: string;
  sdk: { name: string; version: string };
  platform: string;
  environment: string;
  release?: string;
  context: Record<string, unknown>;
  trace?: TraceContext;
  payload: T;
}
```

The source interface keeps the new metadata optional temporarily so existing local/custom transports remain compatible. `Client` fills all fields before sending; the ingest gateway treats them as required.

Limits for the MVP gateway:

- maximum 50 events per batch;
- maximum 512 KiB request body;
- maximum 64 KiB per event;
- only schema version `1.0` is accepted;
- `(projectId, eventId)` is idempotent.
