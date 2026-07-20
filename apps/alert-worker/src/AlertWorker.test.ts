import { describe, expect, it, vi } from "vitest";
import { AlertWorker, type AlertStore } from "./AlertWorker";
import { loadConfig } from "./config";
import type { AlertRule } from "./types";

const rule: AlertRule = {
  id: "1", projectId: "demo-project", name: "LCP", type: "performance_p75",
  metric: "LCP", threshold: 2500, windowMinutes: 5, consecutivePeriods: 1,
  cooldownMinutes: 15, environment: null, release: null, platform: "web", webhookUrl: null,
};

function store(): AlertStore {
  return {
    listEnabledRules: vi.fn().mockResolvedValue([rule]),
    evaluateValue: vi.fn().mockResolvedValue(3000),
    recordEvaluation: vi.fn().mockResolvedValue(true),
    claimDeliveries: vi.fn().mockResolvedValue([]),
    markDelivered: vi.fn().mockResolvedValue(undefined),
    markDeliveryFailure: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AlertWorker", () => {
  it("evaluates each rule once for its completed window", async () => {
    const repository = store();
    const worker = new AlertWorker(loadConfig({}), repository);
    const result = await worker.runOnce(new Date("2026-07-20T12:07:00Z"));

    expect(result).toEqual({ evaluated: 1, delivered: 0 });
    expect(repository.recordEvaluation).toHaveBeenCalledWith(
      rule,
      { start: new Date("2026-07-20T12:00:00Z"), end: new Date("2026-07-20T12:05:00Z") },
      3000,
      true,
    );
  });
});
