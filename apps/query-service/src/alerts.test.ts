import { describe, expect, it } from "vitest";
import { parseCreateAlertRule } from "./alerts";

describe("alert rule validation", () => {
  it("normalizes an error count rule", () => {
    expect(parseCreateAlertRule({
      name: " 错误激增 ",
      type: "error_count",
      metric: "LCP",
      threshold: 5,
    })).toEqual({
      ok: true,
      value: expect.objectContaining({
        name: "错误激增",
        metric: null,
        windowMinutes: 5,
        consecutivePeriods: 1,
        cooldownMinutes: 15,
      }),
    });
  });

  it("rejects unsafe or malformed performance rules", () => {
    expect(parseCreateAlertRule({
      name: "LCP",
      type: "performance_p75",
      metric: "UNKNOWN",
      threshold: 1,
    })).toMatchObject({ ok: false, reason: "invalid_alert_metric" });
    expect(parseCreateAlertRule({
      name: "LCP",
      type: "performance_p75",
      metric: "LCP",
      threshold: 1,
      webhookUrl: "file:///tmp/alert",
    })).toMatchObject({ ok: false, reason: "invalid_webhook_url" });
  });
});
