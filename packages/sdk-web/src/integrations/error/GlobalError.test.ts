import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { GlobalErrorIntegration } from "./GlobalError";

type OnError = (
  message: string,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error,
) => unknown;

// 在 node 测试环境里手动桩一个最小 window，避免引入 jsdom
const globalRef = globalThis as { window?: { onerror?: OnError } };

afterEach(() => {
  delete globalRef.window;
});

describe("GlobalErrorIntegration", () => {
  it("setup 后 window.onerror 抛错会 capture 一个统一的 error 事件", () => {
    globalRef.window = {};
    const capture = vi.fn<(event: BaseEvent) => void>();
    const client = { capture } as unknown as Client;

    new GlobalErrorIntegration().setup(client);
    expect(typeof globalRef.window.onerror).toBe("function");

    const err = new Error("boom");
    globalRef.window.onerror?.("boom", "app.js", 10, 5, err);

    expect(capture).toHaveBeenCalledTimes(1);
    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("error");
    expect(event.payload).toMatchObject({
      message: "boom",
      source: "app.js",
      lineno: 10,
      colno: 5,
      stack: err.stack,
    });
  });

  it("非浏览器环境（无 window）安全降级，不抛错", () => {
    const client = { capture: vi.fn() } as unknown as Client;
    expect(() => new GlobalErrorIntegration().setup(client)).not.toThrow();
  });
});
