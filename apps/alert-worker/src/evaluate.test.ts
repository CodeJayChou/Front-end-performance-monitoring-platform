import { describe, expect, it } from "vitest";
import { completedWindow, decideState } from "./evaluate";
import type { AlertRule, AlertState } from "./types";

const rule: AlertRule = {
  id: "1",
  projectId: "demo-project",
  name: "错误激增",
  type: "error_count",
  metric: null,
  threshold: 10,
  windowMinutes: 5,
  consecutivePeriods: 2,
  cooldownMinutes: 15,
  environment: null,
  release: null,
  platform: null,
  webhookUrl: null,
};

const okState: AlertState = {
  status: "ok",
  consecutiveBreaches: 0,
  lastEvaluatedAt: null,
  lastTriggeredAt: null,
  currentIncidentId: null,
};

describe("alert evaluation", () => {
  it("aligns evaluations to completed windows", () => {
    expect(completedWindow(new Date("2026-07-20T12:07:33Z"), 5)).toEqual({
      start: new Date("2026-07-20T12:00:00Z"),
      end: new Date("2026-07-20T12:05:00Z"),
    });
  });

  it("requires consecutive breaches and resolves on recovery", () => {
    const first = decideState(rule, okState, true, new Date("2026-07-20T12:05:00Z"));
    expect(first).toMatchObject({ transition: "none", consecutiveBreaches: 1 });

    const second = decideState(
      rule,
      { ...okState, consecutiveBreaches: first.consecutiveBreaches },
      true,
      new Date("2026-07-20T12:10:00Z"),
    );
    expect(second).toMatchObject({ transition: "triggered", status: "firing" });

    const recovered = decideState(
      rule,
      { ...okState, status: "firing", consecutiveBreaches: 2, currentIncidentId: "7" },
      false,
      new Date("2026-07-20T12:15:00Z"),
    );
    expect(recovered).toEqual({ transition: "resolved", status: "ok", consecutiveBreaches: 0 });
  });

  it("honors cooldown after an incident", () => {
    const result = decideState(
      { ...rule, consecutivePeriods: 1 },
      { ...okState, lastTriggeredAt: new Date("2026-07-20T12:00:00Z") },
      true,
      new Date("2026-07-20T12:10:00Z"),
    );
    expect(result.transition).toBe("none");
  });
});
