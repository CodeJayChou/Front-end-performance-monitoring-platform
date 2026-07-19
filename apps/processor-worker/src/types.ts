export interface ClaimedEvent {
  id: string;
  projectId: string;
  eventId: string;
  type: string;
  eventTimestamp: Date;
  environment: string;
  release: string | null;
  platform: string;
  context: unknown;
  payload: unknown;
  processingAttempts: number;
}

export interface ErrorAnalysis {
  type: "error";
  fingerprint: string;
  kind: string;
  title: string;
  culprit: string | null;
}

export interface MetricAnalysis {
  type: "metric";
  metric: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}

export type EventAnalysis = ErrorAnalysis | MetricAnalysis | null;
