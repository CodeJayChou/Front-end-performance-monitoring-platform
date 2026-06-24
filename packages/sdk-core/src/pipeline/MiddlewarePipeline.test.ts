import { describe, expect, it } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { MiddlewarePipeline } from "./MiddlewarePipeline";

const makeEvent = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload: null,
  ...overrides,
});

describe("MiddlewarePipeline", () => {
  it("无 middleware 时原样返回事件", async () => {
    const pipeline = new MiddlewarePipeline();
    const event = makeEvent();
    expect(await pipeline.execute(event)).toBe(event);
  });

  it("按优先级降序执行 middleware", async () => {
    const order: string[] = [];
    const pipeline = new MiddlewarePipeline();
    pipeline.use({
      name: "low",
      priority: 1,
      handle: (e, next) => {
        order.push("low");
        return next(e);
      },
    });
    pipeline.use({
      name: "high",
      priority: 10,
      handle: (e, next) => {
        order.push("high");
        return next(e);
      },
    });

    await pipeline.execute(makeEvent());
    expect(order).toEqual(["high", "low"]);
  });

  it("同优先级保持注册顺序（稳定排序）", async () => {
    const order: string[] = [];
    const pipeline = new MiddlewarePipeline();
    pipeline.use({ name: "a", handle: (e, next) => (order.push("a"), next(e)) });
    pipeline.use({ name: "b", handle: (e, next) => (order.push("b"), next(e)) });

    await pipeline.execute(makeEvent());
    expect(order).toEqual(["a", "b"]);
  });

  it("某一层返回 null 即终止链路", async () => {
    const order: string[] = [];
    const pipeline = new MiddlewarePipeline();
    pipeline.use({ name: "drop", priority: 10, handle: async () => null });
    pipeline.use({
      name: "after",
      priority: 1,
      handle: (e, next) => (order.push("after"), next(e)),
    });

    expect(await pipeline.execute(makeEvent())).toBeNull();
    expect(order).toEqual([]);
  });

  it("middleware 可改写事件", async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use({
      name: "rewrite",
      handle: (e, next) => next({ ...e, type: "changed" }),
    });

    const result = await pipeline.execute(makeEvent());
    expect(result?.type).toBe("changed");
  });

  it("重复调用 next 会抛错", async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use({
      name: "double",
      handle: async (e, next) => {
        await next(e);
        return next(e);
      },
    });

    await expect(pipeline.execute(makeEvent())).rejects.toThrow(
      "next() 被重复调用",
    );
  });
});
