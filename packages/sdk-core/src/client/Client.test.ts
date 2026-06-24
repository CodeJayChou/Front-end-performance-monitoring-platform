import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { Client } from "./Client";
import type { Integration } from "../integration/Integration";

const makeEvent = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
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

  it("capture 将事件透传到 send（console.log）", () => {
    const client = new Client({ platform: "web" });
    const event = makeEvent();

    client.capture(event);

    expect(logSpy).toHaveBeenCalledWith("[SDK EVENT]", event);
  });

  it("beforeSend 可以改写事件", () => {
    const client = new Client({
      platform: "web",
      beforeSend: (event) => ({ ...event, type: "changed" }),
    });

    client.capture(makeEvent());

    expect(logSpy).toHaveBeenCalledWith(
      "[SDK EVENT]",
      expect.objectContaining({ type: "changed" }),
    );
  });

  it("beforeSend 返回 null 时丢弃事件，不会 send", () => {
    const client = new Client({ platform: "web", beforeSend: () => null });

    client.capture(makeEvent());

    expect(logSpy).not.toHaveBeenCalled();
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
