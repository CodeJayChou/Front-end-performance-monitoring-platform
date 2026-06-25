import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { RouteIntegration } from "./Route";

type Listener = (event: unknown) => void;

const globalRef = globalThis as unknown as {
  window?: {
    addEventListener(type: string, cb: Listener): void;
    removeEventListener(type: string, cb: Listener): void;
    dispatch(type: string): void;
  };
  history?: Pick<History, "pushState" | "replaceState">;
  location?: { href: string };
};

/** 安装 window / history / location 桩，并以可变 href 模拟地址跳转。 */
function installEnv(initialHref: string) {
  const listeners: Record<string, Listener[]> = {};
  const loc = { href: initialHref };
  globalRef.location = loc;
  globalRef.history = {
    pushState: vi.fn(),
    replaceState: vi.fn(),
  } as unknown as History;
  globalRef.window = {
    addEventListener(type, cb) {
      (listeners[type] ??= []).push(cb);
    },
    removeEventListener(type, cb) {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
    },
    dispatch(type) {
      (listeners[type] ?? []).forEach((l) => l(undefined));
    },
  };
  return { loc };
}

afterEach(() => {
  delete globalRef.window;
  delete globalRef.history;
  delete globalRef.location;
});

describe("RouteIntegration", () => {
  it("pushState 触发 route_change 事件，记录 from/to/mode", () => {
    const { loc } = installEnv("https://app/a");
    const capture = vi.fn<(event: BaseEvent) => void>();
    new RouteIntegration().setup({ capture } as unknown as Client);

    // 业务调用 pushState：patch 后会先改地址再通知
    loc.href = "https://app/b";
    history.pushState({}, "", "/b");

    expect(capture).toHaveBeenCalledTimes(1);
    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("behavior");
    expect(event.payload).toMatchObject({
      action: "route_change",
      from: "https://app/a",
      to: "https://app/b",
      mode: "history",
    });
  });

  it("hashchange 触发 hash 模式 route_change", () => {
    const { loc } = installEnv("https://app/#x");
    const capture = vi.fn();
    new RouteIntegration().setup({ capture } as unknown as Client);

    loc.href = "https://app/#y";
    globalRef.window!.dispatch("hashchange");

    const event = capture.mock.calls[0]![0];
    expect(event.payload).toMatchObject({ mode: "hash", to: "https://app/#y" });
  });

  it("URL 未变（如同址 replaceState）不上报", () => {
    installEnv("https://app/a");
    const capture = vi.fn();
    new RouteIntegration().setup({ capture } as unknown as Client);

    history.replaceState({}, "", "/a"); // href 未变
    expect(capture).not.toHaveBeenCalled();
  });

  it("teardown 完整还原被 patch 的 history 方法", () => {
    installEnv("https://app/a");
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const integration = new RouteIntegration();
    integration.setup({ capture: vi.fn() } as unknown as Client);

    expect(history.pushState).not.toBe(originalPush);
    integration.teardown();
    expect(history.pushState).toBe(originalPush);
    expect(history.replaceState).toBe(originalReplace);
  });

  it("非浏览器环境（无 window）安全降级，不抛错", () => {
    const client = { capture: vi.fn() } as unknown as Client;
    expect(() => new RouteIntegration().setup(client)).not.toThrow();
  });
});
