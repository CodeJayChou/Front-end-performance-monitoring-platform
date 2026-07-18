import { describe, expect, it } from "vitest";
import { analyzeEvent, normalizeTitle } from "./analyze";

describe("processor analysis", () => {
  it("groups dynamic error messages into a stable fingerprint", () => {
    const first = analyzeEvent("error", {
      kind: "js",
      message: "Request 123 failed at https://example.com/users/123",
      stackFrames: [{ file: "app.js", line: 10, functionName: "load" }],
    });
    const second = analyzeEvent("error", {
      kind: "js",
      message: "Request 456 failed at https://example.com/users/456",
      stackFrames: [{ file: "app.js", line: 10, functionName: "load" }],
    });

    expect(first?.type).toBe("error");
    expect(first && "fingerprint" in first ? first.fingerprint : null).toBe(
      second && "fingerprint" in second ? second.fingerprint : null,
    );
    expect(normalizeTitle("ID 123  0xFF")).toBe("id <number> <hex>");
  });

  it("accepts Web Vitals and ignores unsupported performance payloads", () => {
    expect(
      analyzeEvent("performance", { metric: "LCP", value: 1200, rating: "good" }),
    ).toMatchObject({ type: "metric", metric: "LCP", value: 1200 });
    expect(
      analyzeEvent("performance", { metric: "LCP", value: 5_000, rating: "good" }),
    ).toMatchObject({ rating: "poor" });
    expect(analyzeEvent("performance", { metric: "LongTask", count: 2 })).toBeNull();
  });
});
