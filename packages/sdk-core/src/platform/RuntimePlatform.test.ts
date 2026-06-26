import { describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import { init } from "../index";
import { HttpTransport } from "../transport/HttpTransport";
import { BaseIntegration } from "../integration/BaseIntegration";
import type { RuntimePlatform } from "./RuntimePlatform";

/**
 * 平台适配口（RuntimePlatform）注入验证 —— 坐实「核心不碰真实全局」：
 * 注入一个完全虚构的 runtime（固定 now / uuid / 空 global），
 * 事件 id、时间戳、trace id、网络出口全部由它决定。
 */

/** 仅暴露一个 fire() 触发 emit 的最小插件，绕过 DOM 支持性探测。 */
class TestIntegration extends BaseIntegration {
  name = "test";
  protected isSupported(): boolean {
    return true;
  }
  protected install(): void {}
  fire(): void {
    this.emit("custom", { ok: true });
  }
}

function fakeRuntime(global: RuntimePlatform["global"] = {}): RuntimePlatform {
  return {
    now: () => 4242,
    uuid: () => "uuid-fixed",
    get global() {
      return global;
    },
  };
}

describe("RuntimePlatform 注入", () => {
  it("emit 链路：事件 id 与 timestamp 完全来自注入的 runtime", async () => {
    const transport = { send: vi.fn() };
    const integration = new TestIntegration();
    init({ runtime: fakeRuntime(), transport, integrations: [integration] });

    integration.fire();
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalled());

    const event = transport.send.mock.calls[0]![0] as BaseEvent;
    expect(event.id).toBe("uuid-fixed");
    expect(event.timestamp).toBe(4242);
  });

  it("normalize 兜底：缺失 timestamp 由注入 runtime.now() 补齐", async () => {
    const transport = { send: vi.fn() };
    const client = init({ runtime: fakeRuntime(), transport });

    await client.capture({
      id: "e1",
      type: "custom",
      timestamp: 0,
      platform: "web",
      context: {},
      payload: { ok: true },
    });

    expect((transport.send.mock.calls[0]![0] as BaseEvent).timestamp).toBe(4242);
  });

  it("链路：transaction / span 的 id 与时间取自注入 runtime", () => {
    const client = init({ runtime: fakeRuntime() });
    const tx = client.getHub().startTransaction("load", "navigation");

    expect(tx.id).toBe("uuid-fixed");
    expect(tx.toJSON().duration).toBe(0); // 5000 同源 now() → 起止相减为 0

    const span = tx.startSpan("fetch", "/api");
    expect(span.id).toBe("uuid-fixed");
    expect(span.toJSON().duration).toBe(0);
  });

  it("出口：HttpTransport 经注入 runtime.global.fetch 发送，不碰 globalThis", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    const runtime = fakeRuntime({
      fetch: fetchSpy as unknown as typeof fetch,
    });
    const transport = new HttpTransport({ endpoint: "/ingest" }, runtime);

    await transport.send({
      id: "e1",
      type: "custom",
      timestamp: 0,
      platform: "web",
      context: {},
      payload: { ok: true },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/ingest",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
