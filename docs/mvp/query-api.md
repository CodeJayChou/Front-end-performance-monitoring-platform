# Query API v1

Base URL: `http://localhost:3002`

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

The list aggregates matching environment/release/platform groups by fingerprint. Detail includes recent raw event samples.

### Raw events and releases

```http
GET /api/v1/projects/:projectId/events
GET /api/v1/projects/:projectId/releases
```

Raw event responses are bounded by time range and pagination. Release results contain first/last seen time and event count.
