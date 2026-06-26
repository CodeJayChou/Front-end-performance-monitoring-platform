import { describe, expect, it } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { createContextMiddleware } from "./contextMiddleware";
import type { RuntimePlatform, RuntimeGlobal } from "../platform/RuntimePlatform";

const makeEvent = (context: Record<string, unknown> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context,
  payload: { kind: "js", message: "boom" },
});

const runtimeWith = (global: RuntimeGlobal): RuntimePlatform => ({
  now: () => 0,
  uuid: () => "uuid",
  global,
});

const passThrough = async (e: BaseEvent) => e;

describe("contextMiddleware", () => {
  it("注入 url / userAgent", async () => {
    const mw = createContextMiddleware(
      runtimeWith({
        location: { href: "https://a.com/p" },
        navigator: { userAgent: "UA" },
      }),
    );
    const out = await mw.handle(makeEvent(), passThrough);
    expect(out!.context).toEqual({ url: "https://a.com/p", userAgent: "UA" });
  });

  it("事件自带 context 优先级更高", async () => {
    const mw = createContextMiddleware(
      runtimeWith({ location: { href: "https://env" } }),
    );
    const out = await mw.handle(makeEvent({ url: "https://own" }), passThrough);
    expect(out!.context.url).toBe("https://own");
  });

  it("无 location/navigator（RN/SSR）时不写入 undefined key", async () => {
    const mw = createContextMiddleware(runtimeWith({}));
    const out = await mw.handle(makeEvent({ route: "/home" }), passThrough);
    expect(out!.context).toEqual({ route: "/home" });
    expect("url" in out!.context).toBe(false);
    expect("userAgent" in out!.context).toBe(false);
  });
});
