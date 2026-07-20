# Query API v1

Base URL: `http://localhost:13002`

All project endpoints require a project-scoped administrative key:

```http
Authorization: Bearer demo-admin-key
```

The public SDK ingest key cannot read data.

## Common filters

- `from`, `to`: ISO-8601 timestamps; defaults to the latest 24 hours; maximum 31 days.
- `environment`: exact environment match.
- `release`: exact release match.
- `platform`: exact platform match.
- `limit`: defaults to 50, maximum 200.
- `offset`: defaults to 0.

## Endpoints

### Project overview

```http
GET /api/v1/projects/:projectId/overview
```

Returns total events, error events, sessions, failed processor events and aggregated Web Vitals.

### Performance series

```http
GET /api/v1/projects/:projectId/performance/series?metric=LCP
```

Returns one-minute values grouped by metric and rating, including count, average, minimum and maximum.

### Error groups

```http
GET /api/v1/projects/:projectId/errors
GET /api/v1/projects/:projectId/errors/:fingerprint
```

The list aggregates matching environment/release/platform groups by fingerprint
and returns the issue status and regression count. Detail includes recent raw
event samples, symbolicated stack frames, breadcrumbs and issue history.

### Error workflow

```http
PATCH /api/v1/projects/:projectId/errors/:fingerprint/status
Content-Type: application/json

{"status":"resolved","note":"fixed in the next release"}
```

Supported states are `unresolved`, `in_progress`, `resolved` and `ignored`.
When a newer event arrives after resolution, the processor automatically moves
the issue back to `unresolved`, increments its regression count and records a
history entry.

### Source Maps

```http
GET    /api/v1/projects/:projectId/source-maps
POST   /api/v1/projects/:projectId/source-maps
DELETE /api/v1/projects/:projectId/source-maps/:sourceMapId
```

Upload JSON uses this shape:

```json
{
  "release": "demo-web@1.2.3",
  "dist": "web",
  "artifactName": "assets/app-abc123.js",
  "sourceMap": { "version": 3, "sources": [], "names": [], "mappings": "" }
}
```

`release` must equal the SDK event release. `artifactName` must equal the
generated frame path or a suffix of it. Uploading the same
project/release/dist/artifact replaces the existing map.

### Raw events and releases

```http
GET /api/v1/projects/:projectId/events
GET /api/v1/projects/:projectId/releases
```

Raw event responses are bounded by time range and pagination. Release results contain first/last seen time and event count.
