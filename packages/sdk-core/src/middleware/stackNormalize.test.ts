import { describe, expect, it } from "vitest";
import type { BaseEvent, StackFrame } from "@monitor/event-contract";
import { createStackNormalizeMiddleware } from "./stackNormalize";

const makeError = (payload: unknown): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload,
});

const passThrough = async (e: BaseEvent) => e;

// 假解析器：把每行包成一帧，便于断言中间件的调用契约
const fakeParser = (stack: string): StackFrame[] =>
  stack.split("\n").map((raw) => ({ raw }));

describe("createStackNormalizeMiddleware", () => {
  it("把错误 payload 的 stack 解析进 stackFrames", async () => {
    const mw = createStackNormalizeMiddleware(fakeParser);
    const event = makeError({ kind: "js", message: "boom", stack: "l1\nl2" });

    const out = await mw.handle(event, passThrough);
    const p = out!.payload as { stackFrames?: StackFrame[] };
    expect(p.stackFrames).toEqual([{ raw: "l1" }, { raw: "l2" }]);
  });

  it("非错误事件不处理", async () => {
    const mw = createStackNormalizeMiddleware(fakeParser);
    const behavior = makeError({ kind: "js", stack: "l1" });
    behavior.type = "behavior";

    const out = await mw.handle(behavior, passThrough);
    expect((out!.payload as { stackFrames?: unknown }).stackFrames).toBeUndefined();
  });

  it("无 stack 字段时不produce stackFrames", async () => {
    const mw = createStackNormalizeMiddleware(fakeParser);
    const event = makeError({ kind: "resource", url: "x.png", resourceType: "img" });

    const out = await mw.handle(event, passThrough);
    expect((out!.payload as { stackFrames?: unknown }).stackFrames).toBeUndefined();
  });

  it("已存在 stackFrames 时不覆盖（幂等）", async () => {
    const mw = createStackNormalizeMiddleware(fakeParser);
    const existing = [{ raw: "kept" }];
    const event = makeError({ kind: "js", stack: "l1", stackFrames: existing });

    const out = await mw.handle(event, passThrough);
    expect((out!.payload as { stackFrames?: StackFrame[] }).stackFrames).toBe(existing);
  });
});
