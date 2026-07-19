import { describe, expect, it, vi } from "vitest";
import { createEvent } from "@monitor/event-contract";
import { BatchHttpTransport } from "./BatchHttpTransport";
import type { RuntimePlatform } from "../platform/RuntimePlatform";

function runtime(fetch: typeof globalThis.fetch): RuntimePlatform {
  return {
    now: () => 1,
    uuid: () => "runtime-id",
    global: { fetch },
  };
}

describe("BatchHttpTransport", () => {
  it("按 batchSize 发送事件且不重新经过全局 fetch patch", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    const transport = new BatchHttpTransport(
      {
        endpoint: "/api/v1/events/batch",
        projectId: "p1",
        sdkKey: "public",
        batchSize: 2,
        flushIntervalMs: 60_000,
      },
      runtime(fetch),
    );

    await transport.send(createEvent("custom", { one: 1 }));
    await transport.send(createEvent("custom", { two: 2 }));
    await transport.flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as { projectId: string; sdkKey: string; events: unknown[] };
    expect(body.projectId).toBe("p1");
    expect(body.sdkKey).toBe("public");
    expect(body.events).toHaveLength(2);
  });

  it("close 会刷新剩余队列且不抛出网络异常", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const transport = new BatchHttpTransport(
      {
        endpoint: "/ingest",
        projectId: "p1",
        sdkKey: "public",
        batchSize: 50,
        maxRetries: 0,
      },
      runtime(fetch),
    );

    await transport.send(createEvent("custom", { ok: true }));
    await expect(transport.close()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("可重试失败会把批次放回队首并在下一次 flush 重发", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, status: 202 });
    const transport = new BatchHttpTransport(
      {
        endpoint: "/ingest",
        projectId: "p1",
        sdkKey: "public",
        batchSize: 50,
        flushIntervalMs: 60_000,
        maxRetries: 0,
      },
      runtime(fetch),
    );

    await transport.send(createEvent("custom", { retained: true }));
    await transport.flush();
    await transport.flush();

    expect(fetch).toHaveBeenCalledTimes(2);
    const retried = JSON.parse(String(fetch.mock.calls[1]![1]?.body)) as {
      events: Array<{ payload: unknown }>;
    };
    expect(retried.events[0]?.payload).toEqual({ retained: true });
  });
});
