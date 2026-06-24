import { afterEach, describe, expect, it, vi } from "vitest";
import { init } from "./index";
import type { Integration } from "./integration/Integration";

describe("init", () => {
  it("默认 platform 为 web，并初始化传入的插件", () => {
    const setup = vi.fn();
    const integration: Integration = { name: "test", setup };

    const client = init({ integrations: [integration] });

    expect(client.platform).toBe("web");
    expect(setup).toHaveBeenCalledWith(client);
  });

  it("可以覆盖 platform", () => {
    expect(init({ platform: "mp" }).platform).toBe("mp");
  });

  it("无插件时也能正常初始化", () => {
    expect(() => init()).not.toThrow();
  });

  describe("dsn → HttpTransport 出口选择", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("提供 dsn 时，capture 的事件经 fetch 上报到该地址", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
      vi.stubGlobal("fetch", fetchSpy);

      const client = init({ dsn: "/ingest" });
      await client.capture({
        id: "e1",
        type: "custom",
        timestamp: 0,
        platform: "web",
        context: {},
        payload: { ok: true },
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/ingest",
        expect.objectContaining({ method: "POST", keepalive: true }),
      );
    });

    it("显式 transport 优先于 dsn", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
      vi.stubGlobal("fetch", fetchSpy);
      const transport = { send: vi.fn() };

      const client = init({ dsn: "/ingest", transport });
      await client.capture({
        id: "e1",
        type: "custom",
        timestamp: 0,
        platform: "web",
        context: {},
        payload: { ok: true },
      });

      expect(transport.send).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
