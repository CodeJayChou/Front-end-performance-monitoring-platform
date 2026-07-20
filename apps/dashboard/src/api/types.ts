export type TimeRange = "1h" | "24h" | "7d" | "30d";

export interface ConnectionConfig {
  baseUrl: string;
  projectId: string;
  adminKey: string;
}

export interface DashboardFilters {
  range: TimeRange;
  environment: string;
  release: string;
  platform: string;
}

export interface ApiFilters {
  from: string;
  to: string;
  environment?: string;
  release?: string;
  platform?: string;
  scenario?: string;
  limit?: number;
  offset?: number;
}

export interface VitalSummary {
  metric: string;
  sampleCount: number;
  average: number | null;
  p75: number | null;
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface Overview {
  totalEvents: number;
  errorEvents: number;
  sessions: number;
  failedEvents: number;
  pendingEvents: number;
  latestReceivedAt: string | null;
  latestProcessedAt: string | null;
  vitals: VitalSummary[];
}

export interface PerformancePoint {
  bucketStart: string;
  metric: string;
  rating: string;
  sampleCount: number;
  average: number;
  p75: number | null;
  minimum: number;
  maximum: number;
}

export interface ErrorGroup {
  fingerprint: string;
  kind: string;
  title: string;
  culprit: string;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  environments: string[];
  releases: string[];
  platforms: string[];
}

export interface EventRecord {
  eventId: string;
  schemaVersion?: string;
  type?: string;
  eventTimestamp: string;
  receivedAt?: string;
  sessionId: string;
  environment: string;
  release: string | null;
  platform: string;
  sdk?: unknown;
  trace?: unknown;
  context: unknown;
  payload: unknown;
  processingStatus?: string;
}

export interface ErrorDetail {
  group: ErrorGroup;
  events: EventRecord[];
}

export interface ReleaseSummary {
  release: string;
  eventCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface PageResult<T> {
  total: number;
  items: T[];
}

export type AlertRuleType = "error_count" | "performance_p75";

export interface AlertRule {
  id: string;
  name: string;
  type: AlertRuleType;
  metric: string | null;
  threshold: number;
  windowMinutes: number;
  consecutivePeriods: number;
  cooldownMinutes: number;
  environment: string | null;
  release: string | null;
  platform: string | null;
  webhookUrl: string | null;
  enabled: boolean;
  status: "ok" | "firing";
  consecutiveBreaches: number;
  lastValue: number | null;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
}

export interface CreateAlertRule {
  name: string;
  type: AlertRuleType;
  metric?: string;
  threshold: number;
  windowMinutes: number;
  consecutivePeriods: number;
  cooldownMinutes: number;
  environment?: string;
  release?: string;
  platform?: string;
  webhookUrl?: string;
  enabled?: boolean;
}

export interface AlertIncident {
  id: string;
  status: "firing" | "resolved";
  startedAt: string;
  resolvedAt: string | null;
  triggerValue: number;
  lastValue: number;
  windowStart: string;
  windowEnd: string;
  ruleId: string;
  ruleName: string;
  ruleType: AlertRuleType;
  metric: string | null;
  threshold: number;
}
