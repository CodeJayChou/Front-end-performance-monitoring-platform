export type AlertRuleType = "error_count" | "performance_p75";
export type AlertStateStatus = "ok" | "firing";

export interface AlertRule {
  id: string;
  projectId: string;
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
}

export interface AlertState {
  status: AlertStateStatus;
  consecutiveBreaches: number;
  lastEvaluatedAt: Date | null;
  lastTriggeredAt: Date | null;
  currentIncidentId: string | null;
}

export interface ClaimedDelivery {
  id: string;
  webhookUrl: string;
  payload: unknown;
  attempts: number;
}

export interface EvaluationWindow {
  start: Date;
  end: Date;
}

export type AlertTransition = "none" | "triggered" | "resolved";

export interface StateDecision {
  transition: AlertTransition;
  status: AlertStateStatus;
  consecutiveBreaches: number;
}
