import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { PromiseRejectionIntegration } from "./PromiseRejection";

type Listener = (event: { reason: unknown }) => void;

// 最小 window 桩：记录监听器，避免引入 jsdom
const listeners = new Map<string, Listener>();
const globalRef = globalThis as {
  window?: {
    addEventListener: (type: string, cb: Listener) => void;
    removeEventListener: (type: string, cb: Listener) => void;
  };
};

function stubWindow(): void {
  globalRef.window = {
    addEventListener: (type, cb) => listeners.set(type, cb),
    removeEventListener: (type) => listeners.delete(type),
  };
}

afterEach(() => {
  delete globalRef.window;
  listeners.clear();
});

describe("PromiseRejectionIntegration", () => {
  it("setup 后 unhandledrejection 会 capture 一个 error 事件（kind:promise）", () => {
    stubWindow();
    const capture = vi.fn<(event: BaseEvent) => void>();
    const client = { capture } as unknown as Client;

    new PromiseRejectionIntegration().setup(client);
    const err = new Error("rejected");
    listeners.get("unhandledrejection")?.({ reason: err });

    expect(capture).toHaveBeenCalledTimes(1);
    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("error");
    expect(event.payload).toMatchObject({
      kind: "promise",
      reason: "rejected",
      stack: err.stack,
    });
  });

  it("reason 为字符串时原样上报", () => {
    stubWindow();
    const capture = vi.fn<(event: BaseEvent) => void>();
    const client = { capture } as unknown as Client;

    new PromiseRejectionIntegration().setup(client);
    listeners.get("unhandledrejection")?.({ reason: "boom" });

    expect(capture.mock.calls[0]![0].payload).toMatchObject({
      kind: "promise",
      reason: "boom",
      stack: undefined,
    });
  });

  it("teardown 后移除监听", () => {
    stubWindow();
    const client = { capture: vi.fn() } as unknown as Client;
    const integration = new PromiseRejectionIntegration();
    integration.setup(client);
    expect(listeners.has("unhandledrejection")).toBe(true);
    integration.teardown();
    expect(listeners.has("unhandledrejection")).toBe(false);
  });

  it("非浏览器环境（无 window）安全降级，不抛错", () => {
    const client = { capture: vi.fn() } as unknown as Client;
    expect(() =>
      new PromiseRejectionIntegration().setup(client),
    ).not.toThrow();
  });
});
