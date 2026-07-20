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

export type SymbolicationStatus =
  | "not_attempted"
  | "no_stack"
  | "no_release"
  | "map_not_found"
  | "symbolicated"
  | "failed";

export interface SymbolicatedFrame {
  file?: string;
  line?: number;
  col?: number;
  functionName?: string;
  raw?: string;
  originalFile: string;
  originalLine: number;
  originalCol: number;
  originalFunctionName?: string;
  sourceLine?: string;
  inApp: boolean;
}

export interface SymbolicationResult {
  status: SymbolicationStatus;
  stack: SymbolicatedFrame[] | null;
}
