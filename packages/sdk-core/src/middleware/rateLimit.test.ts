import { describe, expect, it } from "vitest";
import type { BaseEvent, EventRuntime } from "@monitor/event-contract";
import { createRateLimitMiddleware, TokenBucket } from "./rateLimit";

const makeEvent = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload: { kind: "js", message: "boom" },
  ...overrides,
});

const clockRuntime = (read: () => number): EventRuntime => ({
  now: read,
  uuid: () => "uuid",
});

const passThrough = async (e: BaseEvent) => e;

describe("TokenBucket", () => {
  it("容量内连续放行，耗尽后拒绝", () => {
    const bucket = new TokenBucket(2, 1);
    expect(bucket.allow(0)).toBe(true);
    expect(bucket.allow(0)).toBe(true);
    expect(bucket.allow(0)).toBe(false); // 令牌耗尽
  });

  it("按时间补充令牌（refillPerSec）", () => {
    const bucket = new TokenBucket(2, 1); // 每秒补 1
    bucket.allow(0);
    bucket.allow(0); // 耗尽
    expect(bucket.allow(0)).toBe(false);
    expect(bucket.allow(1000)).toBe(true); // 1s 后补 1 个
    expect(bucket.allow(1000)).toBe(false);
  });

  it("补充不超过容量上限", () => {
    const bucket = new TokenBucket(2, 100);
    bucket.allow(0);
    bucket.allow(0); // 耗尽
    // 长时间空转也最多补满到 capacity=2
    expect(bucket.allow(10_000)).toBe(true);
    expect(bucket.allow(10_000)).toBe(true);
    expect(bucket.allow(10_000)).toBe(false);
  });
});

describe("createRateLimitMiddleware", () => {
  it("超额事件被丢弃", async () => {
    const mw = createRateLimitMiddleware(
      { capacity: 1, refillPerSec: 0 },
      clockRuntime(() => 0),
    );
    expect(await mw.handle(makeEvent(), passThrough)).not.toBeNull();
    expect(await mw.handle(makeEvent(), passThrough)).toBeNull();
  });

  it("指定 types 时只限流命中类型，其它放行", async () => {
    const mw = createRateLimitMiddleware(
      { capacity: 1, refillPerSec: 0, types: ["error"] },
      clockRuntime(() => 0),
    );
    const behavior = makeEvent({ type: "behavior", payload: { action: "click" } });
    // behavior 不消耗 error 桶，始终放行
    expect(await mw.handle(behavior, passThrough)).toBe(behavior);
    expect(await mw.handle(behavior, passThrough)).toBe(behavior);
    // error 受限
    expect(await mw.handle(makeEvent(), passThrough)).not.toBeNull();
    expect(await mw.handle(makeEvent(), passThrough)).toBeNull();
  });
});
