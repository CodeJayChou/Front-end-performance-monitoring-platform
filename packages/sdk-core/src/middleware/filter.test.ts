import { describe, expect, it } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { filter } from "./filter";

const makeEvent = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload: { kind: "js", message: "boom" },
  ...overrides,
});

describe("filter", () => {
  it("丢弃 null / 无 type 的事件", () => {
    expect(filter(null)).toBeNull();
    expect(filter(makeEvent({ type: "" }))).toBeNull();
  });

  it("放行结构完整的错误事件", () => {
    const event = makeEvent();
    expect(filter(event)).toBe(event);
  });

  it("放行非错误事件而不校验其 payload", () => {
    const perf = makeEvent({ type: "performance", payload: { metric: "lcp" } });
    expect(filter(perf)).toBe(perf);
    // 即便 payload 为 null，非 error 类型也不拦
    const custom = makeEvent({ type: "custom", payload: null });
    expect(filter(custom)).toBe(custom);
  });

  it("丢弃畸形的错误 payload", () => {
    // payload 非对象
    expect(filter(makeEvent({ payload: null }))).toBeNull();
    // 缺 kind
    expect(filter(makeEvent({ payload: { message: "x" } }))).toBeNull();
    // js 错误缺 message
    expect(filter(makeEvent({ payload: { kind: "js" } }))).toBeNull();
    // resource 错误缺 url
    expect(
      filter(makeEvent({ payload: { kind: "resource", resourceType: "img" } })),
    ).toBeNull();
  });

  it("放行带非空 kind 的开放错误种类（交贡献方负责）", () => {
    const native = makeEvent({ payload: { kind: "native_crash", detail: "x" } });
    expect(filter(native)).toBe(native);
  });
});
