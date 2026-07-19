import { describe, expect, it } from "vitest";
import { createEvent } from "@monitor/event-contract";
import { sanitizeEvent, sanitizeUrl } from "./privacy";

describe("privacy middleware", () => {
  it("移除敏感字段、URL 查询和默认文本", () => {
    const event = createEvent("custom", {
      text: "secret text",
      token: "do-not-send",
      url: "https://example.com/page?token=abc&keep=1#hash",
    });
    const sanitized = sanitizeEvent({
      ...event,
      context: {
        url: "https://example.com/home?token=abc#hash",
        user: { id: "u1", email: "hidden@example.com" },
        breadcrumbs: Array.from({ length: 60 }, (_, i) => ({ message: String(i) })),
      },
    });

    expect(sanitized.payload).toEqual({ url: "https://example.com/page" });
    expect(sanitized.context.url).toBe("https://example.com/home");
    expect(sanitized.context.user).toEqual({ id: "u1" });
    expect(sanitized.context.breadcrumbs).toHaveLength(50);
  });

  it("允许显式 URL 参数和文本采集", () => {
    expect(sanitizeUrl("https://example.com/a?keep=1&drop=2#x", ["keep"])).toBe(
      "https://example.com/a?keep=1",
    );
    const event = createEvent("custom", { text: "visible" });
    expect(sanitizeEvent(event, { captureText: true }).payload).toEqual({ text: "visible" });
  });

  it("preserves numeric metric values while removing text input values", () => {
    const event = createEvent("performance", {
      metric: "LCP",
      value: 1234,
      rating: "good",
      form: { value: "private input" },
    });

    expect(sanitizeEvent(event).payload).toEqual({
      metric: "LCP",
      value: 1234,
      rating: "good",
      form: {},
    });
  });
});
