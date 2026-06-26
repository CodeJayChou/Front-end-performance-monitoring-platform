import { describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { Client } from "../client/Client";
import { Hub } from "./Hub";

const makeEvent = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload: { kind: "js", message: "test" },
  ...overrides,
});

describe("Hub", () => {
  it("captureEvent 会用当前 Scope 注入上下文后交给 Client", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });
    const hub = client.getHub(); // 复用 Client 的唯一 Hub（context 单点）

    hub.configureScope((scope) => {
      scope.setUser({ id: "123" }).setTag("env", "prod");
    });

    await hub.captureEvent(makeEvent());

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          user: { id: "123" },
          tags: { env: "prod" },
        }),
      }),
    );
  });

  it("pushScope/popScope 形成隔离的作用域栈", () => {
    const client = new Client({ platform: "web" });
    const hub = new Hub(client);

    hub.getScope().setTag("scope", "root");
    const child = hub.pushScope();
    child.setTag("scope", "child");

    expect(hub.getScope()).toBe(child);
    hub.popScope();
    expect(hub.getScope().getContext().tags).toEqual({ scope: "root" });
  });

  it("popScope 不会弹出栈底根 Scope", () => {
    const hub = new Hub(new Client({ platform: "web" }));
    const root = hub.getScope();
    expect(hub.popScope()).toBeUndefined();
    expect(hub.getScope()).toBe(root);
  });

  it("withScope 内的改动在结束后被还原", () => {
    const hub = new Hub(new Client({ platform: "web" }));
    hub.getScope().setTag("k", "root");

    hub.withScope((scope) => {
      scope.setTag("k", "temp");
      expect(hub.getScope().getContext().tags).toEqual({ k: "temp" });
    });

    expect(hub.getScope().getContext().tags).toEqual({ k: "root" });
  });

  it("startTransaction 绑定到当前 Scope，event 会带上 trace", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });
    const hub = client.getHub(); // 复用 Client 的唯一 Hub（context 单点）

    const tx = hub.startTransaction("page-load", "navigation");
    const span = tx.startSpan("fetch", "/api/user");

    await hub.captureEvent(makeEvent());

    span.finish();
    tx.finish();

    const sent = transport.send.mock.calls[0]![0] as BaseEvent;
    expect(sent.trace).toEqual({
      traceId: tx.id,
      transactionId: tx.id,
      spanId: span.id,
    });
  });
});
