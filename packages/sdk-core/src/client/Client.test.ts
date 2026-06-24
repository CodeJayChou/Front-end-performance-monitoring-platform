import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { Client } from "./Client";
import { Monitor } from "../hub/Monitor";
import type { Integration } from "../integration/Integration";

const makeEvent = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload: null,
  ...overrides,
});

describe("Client", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it("capture 将事件经 pipeline 透传到默认 transport（console.log）", async () => {
    const client = new Client({ platform: "web" });

    await client.capture(makeEvent());

    expect(logSpy).toHaveBeenCalledWith(
      "[SDK EVENT]",
      expect.objectContaining({ type: "error", platform: "web" }),
    );
  });

  it("enrich 会把 Scope 上下文合并进事件", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });
    client.scope.setUser({ id: "u1" }).setRoute("/home");

    await client.capture(makeEvent());

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ user: { id: "u1" }, route: "/home" }),
      }),
    );
  });

  it("normalize 会补齐缺失的 timestamp", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });

    await client.capture(makeEvent({ timestamp: 0 }));

    const sent = transport.send.mock.calls[0]![0] as BaseEvent;
    expect(sent.timestamp).toBeGreaterThan(0);
  });

  it("sampleRate 为 0 时丢弃事件，不会 send", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", sampleRate: 0, transport });

    await client.capture(makeEvent());

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("自定义 middleware 可改写 / 丢弃事件", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });
    client.addMiddleware({
      name: "tagger",
      handle: (event, next) =>
        next({ ...event, context: { ...event.context, tagged: true } }),
    });

    await client.capture(makeEvent());

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ tagged: true }),
      }),
    );
  });

  it("middleware 返回 null 时丢弃事件，不会 send", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });
    client.addMiddleware({ name: "drop", handle: async () => null });

    await client.capture(makeEvent());

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("beforeSend 可以改写事件", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({
      platform: "web",
      transport,
      beforeSend: (event) => ({ ...event, type: "changed" }),
    });

    await client.capture(makeEvent());

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "changed" }),
    );
  });

  it("beforeSend 返回 null 时丢弃事件，不会 send", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport, beforeSend: () => null });

    await client.capture(makeEvent());

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("integration.beforeSend 返回 null 时丢弃事件，不会进入 pipeline", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });
    const integration: Integration = {
      name: "guard",
      setup: () => {},
      beforeSend: () => null,
    };
    client.use(integration);

    await client.capture(makeEvent());

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("结构非法事件（缺 type）在校验阶段被丢弃，不会 send", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });

    // 故意构造缺 type 的脏事件
    await client.capture({ id: "x", payload: {} } as unknown as BaseEvent);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("Monitor 与 client.capture 共享同一 Scope（context 单点）", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport });
    const monitor = new Monitor(client);

    // 经 Monitor 写上下文，直采路径也应看见 —— 证明只有一套 Scope
    monitor.configureScope((scope) => scope.setUser({ id: "shared" }));
    await client.capture(makeEvent());

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ user: { id: "shared" } }),
      }),
    );
    // Monitor 复用 Client 的唯一 Hub，而非另建
    expect(monitor.hub).toBe(client.getHub());
  });

  it("close() 会调用每个插件的 teardown", () => {
    const client = new Client({ platform: "web" });
    const teardown = vi.fn();
    const integration: Integration = { name: "t", setup: () => {}, teardown };
    client.use(integration);

    client.close();

    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("debug 模式下打印事件流", async () => {
    const transport = { send: vi.fn() };
    const client = new Client({ platform: "web", transport, debug: true });

    await client.capture(makeEvent());

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[SDK FLOW]"),
      expect.anything(),
    );
  });

  it("registerIntegration + setupIntegrations 会调用插件 setup 并传入自身", () => {
    const client = new Client({ platform: "web" });
    const setup = vi.fn();
    const integration: Integration = { name: "test", setup };

    client.registerIntegration(integration);
    client.setupIntegrations();

    expect(setup).toHaveBeenCalledTimes(1);
    expect(setup).toHaveBeenCalledWith(client);
  });

  it("暴露 platform", () => {
    expect(new Client({ platform: "mp" }).platform).toBe("mp");
  });
});
