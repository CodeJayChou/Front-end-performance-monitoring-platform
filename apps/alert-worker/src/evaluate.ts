import type { AlertRule, AlertState, EvaluationWindow, StateDecision } from "./types";

export function completedWindow(now: Date, windowMinutes: number): EvaluationWindow {
  const duration = windowMinutes * 60_000;
  const endMs = Math.floor(now.getTime() / duration) * duration;
  return { start: new Date(endMs - duration), end: new Date(endMs) };
}

export function isBreached(rule: AlertRule, value: number): boolean {
  return value >= rule.threshold;
}

export function decideState(
  rule: AlertRule,
  state: AlertState,
  breached: boolean,
  evaluatedAt: Date,
): StateDecision {
  const consecutiveBreaches = breached ? state.consecutiveBreaches + 1 : 0;

  if (state.status === "firing") {
    return breached
      ? { transition: "none", status: "firing", consecutiveBreaches }
      : { transition: "resolved", status: "ok", consecutiveBreaches: 0 };
  }

  const cooldownElapsed =
    !state.lastTriggeredAt ||
    evaluatedAt.getTime() - state.lastTriggeredAt.getTime() >= rule.cooldownMinutes * 60_000;
  if (breached && consecutiveBreaches >= rule.consecutivePeriods && cooldownElapsed) {
    return { transition: "triggered", status: "firing", consecutiveBreaches };
  }
  return { transition: "none", status: "ok", consecutiveBreaches };
}
