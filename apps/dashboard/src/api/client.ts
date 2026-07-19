import type {
  ApiFilters,
  ConnectionConfig,
  ErrorDetail,
  ErrorGroup,
  EventRecord,
  Overview,
  PageResult,
  PerformancePoint,
  ReleaseSummary,
  VitalSummary,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class QueryClient {
  private readonly root: string;

  constructor(private readonly connection: ConnectionConfig) {
    this.root = `${connection.baseUrl.replace(/\/$/, "")}/api/v1/projects/${encodeURIComponent(connection.projectId)}`;
  }

  overview(filters: ApiFilters, signal?: AbortSignal): Promise<Overview> {
    return this.get("overview", filters, signal).then(normalizeOverview);
  }

  performance(
    filters: ApiFilters,
    metric: string,
    signal?: AbortSignal,
  ): Promise<PerformancePoint[]> {
    return this.get("performance/series", { ...filters, metric }, signal).then(
      (value) => arrayFrom(value, "items").map(normalizePerformancePoint),
    );
  }

  errors(filters: ApiFilters, signal?: AbortSignal): Promise<PageResult<ErrorGroup>> {
    return this.get("errors", filters, signal).then((value) => ({
      total: numberFrom(recordFrom(value).total),
      items: arrayFrom(value, "items").map(normalizeErrorGroup),
    }));
  }

  errorDetail(
    fingerprint: string,
    filters: ApiFilters,
    signal?: AbortSignal,
  ): Promise<ErrorDetail> {
    return this.get(`errors/${encodeURIComponent(fingerprint)}`, filters, signal).then(
      (value) => {
        const record = recordFrom(value);
        return {
          group: normalizeErrorGroup(record.group),
          events: Array.isArray(record.events)
            ? record.events.map(normalizeEvent)
            : [],
        };
      },
    );
  }

  events(filters: ApiFilters, signal?: AbortSignal): Promise<PageResult<EventRecord>> {
    return this.get("events", filters, signal).then((value) => ({
      total: numberFrom(recordFrom(value).total),
      items: arrayFrom(value, "items").map(normalizeEvent),
    }));
  }

  releases(filters: ApiFilters, signal?: AbortSignal): Promise<ReleaseSummary[]> {
    return this.get("releases", filters, signal).then((value) =>
      arrayFrom(value, "items").map((item) => {
        const row = recordFrom(item);
        return {
          release: stringFrom(row.release),
          eventCount: numberFrom(row.event_count),
          firstSeen: stringFrom(row.first_seen),
          lastSeen: stringFrom(row.last_seen),
        };
      }),
    );
  }

  private async get(
    path: string,
    filters: object,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    let response: Response;
    try {
      response = await fetch(`${this.root}/${path}?${params}`, {
        headers: { Authorization: `Bearer ${this.connection.adminKey}` },
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, "无法连接 Query Service，请确认本地服务正在运行。");
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const fallback = response.status === 401 ? "管理密钥无效或无权访问该项目。" : "查询请求失败。";
      throw new ApiError(response.status, body?.error ?? fallback);
    }
    return response.json();
  }
}

function normalizeOverview(value: unknown): Overview {
  const row = recordFrom(value);
  return {
    totalEvents: numberFrom(row.total_events),
    errorEvents: numberFrom(row.error_events),
    sessions: numberFrom(row.sessions),
    failedEvents: numberFrom(row.failed_events),
    pendingEvents: numberFrom(row.pending_events),
    latestReceivedAt: row.latest_received_at === null ? null : optionalStringFrom(row.latest_received_at) ?? null,
    latestProcessedAt: row.latest_processed_at === null ? null : optionalStringFrom(row.latest_processed_at) ?? null,
    vitals: Array.isArray(row.vitals) ? row.vitals.map(normalizeVital) : [],
  };
}

function normalizeVital(value: unknown): VitalSummary {
  const row = recordFrom(value);
  return {
    metric: stringFrom(row.metric),
    sampleCount: numberFrom(row.sample_count),
    average: nullableNumberFrom(row.average),
    p75: nullableNumberFrom(row.p75),
    good: numberFrom(row.good),
    needsImprovement: numberFrom(row.needs_improvement),
    poor: numberFrom(row.poor),
  };
}

function normalizePerformancePoint(value: unknown): PerformancePoint {
  const row = recordFrom(value);
  return {
    bucketStart: stringFrom(row.bucket_start),
    metric: stringFrom(row.metric),
    rating: stringFrom(row.rating),
    sampleCount: numberFrom(row.sample_count),
    average: numberFrom(row.average),
    p75: nullableNumberFrom(row.p75),
    minimum: numberFrom(row.minimum),
    maximum: numberFrom(row.maximum),
  };
}

function normalizeErrorGroup(value: unknown): ErrorGroup {
  const row = recordFrom(value);
  return {
    fingerprint: stringFrom(row.fingerprint),
    kind: stringFrom(row.kind),
    title: stringFrom(row.title),
    culprit: stringFrom(row.culprit),
    firstSeen: stringFrom(row.first_seen),
    lastSeen: stringFrom(row.last_seen),
    eventCount: numberFrom(row.event_count),
    environments: stringArrayFrom(row.environments),
    releases: stringArrayFrom(row.releases),
    platforms: stringArrayFrom(row.platforms),
  };
}

function normalizeEvent(value: unknown): EventRecord {
  const row = recordFrom(value);
  return {
    eventId: stringFrom(row.event_id),
    schemaVersion: optionalStringFrom(row.schema_version),
    type: optionalStringFrom(row.type),
    eventTimestamp: stringFrom(row.event_timestamp),
    receivedAt: optionalStringFrom(row.received_at),
    sessionId: stringFrom(row.session_id),
    environment: stringFrom(row.environment),
    release: row.release === null ? null : optionalStringFrom(row.release) ?? null,
    platform: stringFrom(row.platform),
    sdk: row.sdk,
    trace: row.trace,
    context: row.context,
    payload: row.payload,
    processingStatus: optionalStringFrom(row.processing_status),
  };
}

function recordFrom(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function arrayFrom(value: unknown, key: string): unknown[] {
  const item = recordFrom(value)[key];
  return Array.isArray(item) ? item : [];
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function optionalStringFrom(value: unknown): string | undefined {
  const result = stringFrom(value);
  return result || undefined;
}

function stringArrayFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringFrom).filter(Boolean) : [];
}

function numberFrom(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function nullableNumberFrom(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return numberFrom(value);
}
