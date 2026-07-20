import type {
  AlertIncident,
  AlertRule,
  ApiFilters,
  ConnectionConfig,
  CreateAlertRule,
  ErrorDetail,
  ErrorGroup,
  EventRecord,
  Overview,
  PageResult,
  PerformancePoint,
  ReleaseSummary,
  SourceMapArtifact,
  SourceMapUpload,
  ErrorIssueStatus,
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
          history: Array.isArray(record.history)
            ? record.history.map(normalizeIssueHistory)
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

  alertRules(signal?: AbortSignal): Promise<AlertRule[]> {
    return this.get("alert-rules", {}, signal).then((value) =>
      arrayFrom(value, "items").map(normalizeAlertRule),
    );
  }

  createAlertRule(input: CreateAlertRule, signal?: AbortSignal): Promise<void> {
    return this.request("alert-rules", { method: "POST", body: input, signal }).then(() => undefined);
  }

  setAlertRuleEnabled(id: string, enabled: boolean, signal?: AbortSignal): Promise<void> {
    return this.request(`alert-rules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { enabled },
      signal,
    }).then(() => undefined);
  }

  deleteAlertRule(id: string, signal?: AbortSignal): Promise<void> {
    return this.request(`alert-rules/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal,
    }).then(() => undefined);
  }

  alertIncidents(filters: ApiFilters, signal?: AbortSignal): Promise<PageResult<AlertIncident>> {
    return this.get("alert-incidents", filters, signal).then((value) => ({
      total: numberFrom(recordFrom(value).total),
      items: arrayFrom(value, "items").map(normalizeAlertIncident),
    }));
  }

  updateErrorIssue(
    fingerprint: string,
    status: ErrorIssueStatus,
    note: string | null,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.request(`errors/${encodeURIComponent(fingerprint)}/status`, {
      method: "PATCH",
      body: { status, note },
      signal,
    }).then(() => undefined);
  }

  sourceMaps(signal?: AbortSignal): Promise<SourceMapArtifact[]> {
    return this.get("source-maps", {}, signal).then((value) =>
      arrayFrom(value, "items").map(normalizeSourceMap),
    );
  }

  uploadSourceMap(input: SourceMapUpload, signal?: AbortSignal): Promise<void> {
    return this.request("source-maps", { method: "POST", body: input, signal }).then(() => undefined);
  }

  deleteSourceMap(id: string, signal?: AbortSignal): Promise<void> {
    return this.request(`source-maps/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal,
    }).then(() => undefined);
  }

  private async get(
    path: string,
    filters: object,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this.request(path, { method: "GET", query: filters, signal });
  }

  private async request(
    path: string,
    options: { method: "GET" | "POST" | "PATCH" | "DELETE"; query?: object; body?: unknown; signal?: AbortSignal },
  ): Promise<unknown> {
    const query = options.query ?? {};
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const suffix = params.size ? `?${params}` : "";
    let response: Response;
    try {
      response = await fetch(`${this.root}/${path}${suffix}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.connection.adminKey}`,
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
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
    return response.status === 204 ? null : response.json();
  }
}

function normalizeAlertRule(value: unknown): AlertRule {
  const row = recordFrom(value);
  return {
    id: stringFrom(row.id),
    name: stringFrom(row.name),
    type: stringFrom(row.type) as AlertRule["type"],
    metric: nullableStringFrom(row.metric),
    threshold: numberFrom(row.threshold),
    windowMinutes: numberFrom(row.window_minutes),
    consecutivePeriods: numberFrom(row.consecutive_periods),
    cooldownMinutes: numberFrom(row.cooldown_minutes),
    environment: nullableStringFrom(row.environment),
    release: nullableStringFrom(row.release),
    platform: nullableStringFrom(row.platform),
    webhookUrl: nullableStringFrom(row.webhook_url),
    enabled: row.enabled === true,
    status: stringFrom(row.status) === "firing" ? "firing" : "ok",
    consecutiveBreaches: numberFrom(row.consecutive_breaches),
    lastValue: nullableNumberFrom(row.last_value),
    lastEvaluatedAt: nullableStringFrom(row.last_evaluated_at),
    lastTriggeredAt: nullableStringFrom(row.last_triggered_at),
  };
}

function normalizeAlertIncident(value: unknown): AlertIncident {
  const row = recordFrom(value);
  return {
    id: stringFrom(row.id),
    status: stringFrom(row.status) === "resolved" ? "resolved" : "firing",
    startedAt: stringFrom(row.started_at),
    resolvedAt: nullableStringFrom(row.resolved_at),
    triggerValue: numberFrom(row.trigger_value),
    lastValue: numberFrom(row.last_value),
    windowStart: stringFrom(row.window_start),
    windowEnd: stringFrom(row.window_end),
    ruleId: stringFrom(row.rule_id),
    ruleName: stringFrom(row.rule_name),
    ruleType: stringFrom(row.rule_type) as AlertIncident["ruleType"],
    metric: nullableStringFrom(row.metric),
    threshold: numberFrom(row.threshold),
  };
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
    status: normalizeIssueStatus(row.status),
    note: nullableStringFrom(row.note),
    resolvedAt: nullableStringFrom(row.resolved_at),
    lastRegressedAt: nullableStringFrom(row.last_regressed_at),
    regressionCount: numberFrom(row.regression_count),
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
    symbolicationStatus: optionalStringFrom(row.symbolication_status),
    symbolicatedStack: Array.isArray(row.symbolicated_stack)
      ? row.symbolicated_stack.map((frame) => {
          const item = recordFrom(frame);
          return {
            file: optionalStringFrom(item.file),
            line: nullableNumberFrom(item.line) ?? undefined,
            col: nullableNumberFrom(item.col) ?? undefined,
            functionName: optionalStringFrom(item.functionName),
            originalFile: stringFrom(item.originalFile),
            originalLine: numberFrom(item.originalLine),
            originalCol: numberFrom(item.originalCol),
            originalFunctionName: optionalStringFrom(item.originalFunctionName),
            sourceLine: optionalStringFrom(item.sourceLine),
            inApp: item.inApp === true,
          };
        })
      : [],
  };
}

function normalizeIssueHistory(value: unknown) {
  const row = recordFrom(value);
  return {
    id: stringFrom(row.id),
    action: stringFrom(row.action),
    fromStatus: nullableStringFrom(row.from_status),
    toStatus: nullableStringFrom(row.to_status),
    note: nullableStringFrom(row.note),
    createdAt: stringFrom(row.created_at),
  };
}

function normalizeSourceMap(value: unknown): SourceMapArtifact {
  const row = recordFrom(value);
  return {
    id: stringFrom(row.id),
    release: stringFrom(row.release),
    dist: stringFrom(row.dist),
    artifactName: stringFrom(row.artifact_name),
    contentHash: stringFrom(row.content_hash),
    sourceCount: numberFrom(row.source_count),
    createdAt: stringFrom(row.created_at),
    updatedAt: stringFrom(row.updated_at),
  };
}

function normalizeIssueStatus(value: unknown): ErrorIssueStatus {
  const status = stringFrom(value);
  return status === "in_progress" || status === "resolved" || status === "ignored"
    ? status
    : "unresolved";
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

function nullableStringFrom(value: unknown): string | null {
  return value === null || value === undefined ? null : optionalStringFrom(value) ?? null;
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
