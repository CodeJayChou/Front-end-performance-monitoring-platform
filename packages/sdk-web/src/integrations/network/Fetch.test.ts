import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { FetchIntegration } from "./Fetch";

// 最小 window 桩：只需带一个 fetch，避免引入 jsdom
const globalRef = globalThis as { window?: { fetch: typeof fetch } };

afterEach(() => {
  delete globalRef.window;
});

describe("FetchIntegration", () => {
  it("成功请求 capture 一个 http 事件，携带 status / duration", async () => {
    const original = vi.fn(async () =>
      ({ status: 200, ok: true }) as Response,
    );
    globalRef.window = { fetch: original as unknown as typeof fetch };

    const capture = vi.fn<(event: BaseEvent) => void>();
    const client = { capture } as unknown as Client;
    new FetchIntegration().setup(client);

    const res = await globalRef.window.fetch("/api/users", { method: "post" });
    expect(res.status).toBe(200);
    expect(original).toHaveBeenCalledTimes(1);

    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("http");
    expect(event.payload).toMatchObject({
      method: "POST",
      url: "/api/users",
      status: 200,
      ok: true,
    });
    expect(typeof (event.payload as { duration: number }).duration).toBe(
      "number",
    );
  });

  it("请求失败 capture 一个 http_error 事件并继续抛出", async () => {
    const original = vi.fn(async () => {
      throw new Error("network down");
    });
    globalRef.window = { fetch: original as unknown as typeof fetch };

    const capture = vi.fn<(event: BaseEvent) => void>();
    const client = { capture } as unknown as Client;
    new FetchIntegration().setup(client);

    await expect(globalRef.window.fetch("/api/x")).rejects.toThrow(
      "network down",
    );
    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("http_error");
    expect(event.payload).toMatchObject({
      method: "GET",
      url: "/api/x",
      error: "network down",
    });
  });

  it("teardown 后还原原始 fetch", () => {
    const original = vi.fn() as unknown as typeof fetch;
    globalRef.window = { fetch: original };
    const integration = new FetchIntegration();
    integration.setup({ capture: vi.fn() } as unknown as Client);
    expect(globalRef.window.fetch).not.toBe(original);
    integration.teardown();
    expect(globalRef.window.fetch).toBe(original);
  });

  it("非浏览器环境（无 window）安全降级，不抛错", () => {
    const client = { capture: vi.fn() } as unknown as Client;
    expect(() => new FetchIntegration().setup(client)).not.toThrow();
  });
});
