import { describe, expect, it } from "vitest";
import type { BaseEvent, EventRuntime } from "@monitor/event-contract";
import {
  createDedupMiddleware,
  fingerprint,
  TtlDedupStore,
  type DedupStore,
} from "./dedup";

const makeError = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload: { kind: "js", message: "boom", source: "a.js", lineno: 1, colno: 2 },
  ...overrides,
});

/** 可控时钟：测试推进时间。 */
const clockRuntime = (read: () => number): EventRuntime => ({
  now: read,
  uuid: () => "uuid",
});

const passThrough = async (e: BaseEvent) => e;

describe("fingerprint", () => {
  it("同一 js 错误（message+位置相同）指纹一致", () => {
    expect(fingerprint(makeError())).toBe(fingerprint(makeError()));
  });

  it("message 不同 → 指纹不同", () => {
    const a = makeError({ payload: { kind: "js", message: "boom" } });
    const b = makeError({ payload: { kind: "js", message: "crash" } });
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it("resource 错误按 url+种类判同", () => {
    const a = makeError({ payload: { kind: "resource", url: "x.png", resourceType: "img" } });
    const b = makeError({ payload: { kind: "resource", url: "x.png", resourceType: "img" } });
    const c = makeError({ payload: { kind: "resource", url: "y.png", resourceType: "img" } });
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(a)).not.toBe(fingerprint(c));
  });
});

describe("TtlDedupStore", () => {
  it("窗口内判重，窗口外放行", () => {
    const store = new TtlDedupStore();
    expect(store.seen("k", 0, 1000)).toBe(false); // 首次
    expect(store.seen("k", 500, 1000)).toBe(true); // 窗口内 → 重复
    expect(store.seen("k", 1001, 1000)).toBe(false); // 已过期 → 放行并重新计时
  });

  it("maxSize 上限保护：超限后旧指纹被淘汰", () => {
    const store = new TtlDedupStore(2);
    store.seen("a", 0, 10_000);
    store.seen("b", 0, 10_000);
    store.seen("c", 0, 10_000); // 触发淘汰最早的 "a"
    expect(store.seen("a", 1, 10_000)).toBe(false); // a 已被淘汰，视为首次
  });
});

describe("createDedupMiddleware", () => {
  it("窗口内重复错误被丢弃，窗口外放行", async () => {
    let now = 0;
    const mw = createDedupMiddleware({ windowMs: 1000 }, clockRuntime(() => now));

    expect(await mw.handle(makeError(), passThrough)).not.toBeNull(); // 首次
    now = 500;
    expect(await mw.handle(makeError(), passThrough)).toBeNull(); // 重复
    now = 1500;
    expect(await mw.handle(makeError(), passThrough)).not.toBeNull(); // 过期放行
  });

  it("默认只对 error 去重，其它类型直接放行", async () => {
    let now = 0;
    const mw = createDedupMiddleware({}, clockRuntime(() => now));
    const behavior = makeError({ type: "behavior", payload: { action: "click" } });

    expect(await mw.handle(behavior, passThrough)).toBe(behavior);
    expect(await mw.handle(behavior, passThrough)).toBe(behavior); // 不去重
  });

  it("可注入自定义 store", async () => {
    const calls: string[] = [];
    const store: DedupStore = {
      seen: (key) => {
        calls.push(key);
        return false;
      },
    };
    const mw = createDedupMiddleware({}, clockRuntime(() => 0), store);
    await mw.handle(makeError(), passThrough);
    expect(calls).toHaveLength(1);
  });
});
