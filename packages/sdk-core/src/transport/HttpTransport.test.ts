import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { HttpTransport } from "./HttpTransport";

const makeEvent = (overrides: Partial<BaseEvent> = {}): BaseEvent => ({
  id: "id-1",
  type: "error",
  timestamp: 0,
  platform: "web",
  context: {},
  payload: { message: "boom" },
  ...overrides,
});

describe("HttpTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST 事件到 endpoint，并带上 keepalive", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchSpy);

    const transport = new HttpTransport({ endpoint: "/ingest" });
    const event = makeEvent();
    await transport.send(event);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/ingest",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      }),
    );
  });

  it("keepalive 可关闭", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchSpy);

    await new HttpTransport({ endpoint: "/ingest", keepalive: false }).send(
      makeEvent(),
    );

    expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ keepalive: false });
  });

  it("网络失败时吞掉异常，不抛回宿主应用", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);

    const transport = new HttpTransport({ endpoint: "/ingest" });
    await expect(transport.send(makeEvent())).resolves.toBeUndefined();
  });

  it("失败按 maxRetries 重试（默认共 3 次尝试）", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { sendBeacon: vi.fn() });

    await new HttpTransport({ endpoint: "/ingest" }).send(makeEvent());

    expect(fetchSpy).toHaveBeenCalledTimes(3); // 首次 + 2 次重试
  });

  it("成功则不重试，只发一次", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchSpy);

    await new HttpTransport({ endpoint: "/ingest", maxRetries: 5 }).send(
      makeEvent(),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("全部重试失败后 sendBeacon 兜底", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { sendBeacon: beacon });

    const event = makeEvent();
    await new HttpTransport({ endpoint: "/ingest", maxRetries: 1 }).send(event);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(beacon).toHaveBeenCalledWith("/ingest", JSON.stringify(event));
  });

  it("无 fetch 时退化到 sendBeacon", async () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("fetch", undefined);
    vi.stubGlobal("navigator", { sendBeacon: beacon });

    const event = makeEvent();
    await new HttpTransport({ endpoint: "/ingest" }).send(event);

    expect(beacon).toHaveBeenCalledWith("/ingest", JSON.stringify(event));
  });

  it("无 fetch 且无 sendBeacon 时安全降级，不报错", async () => {
    vi.stubGlobal("fetch", undefined);
    vi.stubGlobal("navigator", {});

    const transport = new HttpTransport({ endpoint: "/ingest" });
    await expect(transport.send(makeEvent())).resolves.toBeUndefined();
  });
});
