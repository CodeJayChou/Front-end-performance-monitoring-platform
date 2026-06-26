import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Transport } from "@monitor/sdk-core";
import { initWebSDK } from "./index";

/**
 * 端到端契约测试 —— 验证 web-sdk「流程是否完整」。
 *
 * 单元测试只分段验证（integration 打桩 Client、Client 喂合成事件），
 * 接缝从未连起来跑过。这里用 *真实* initWebSDK + 假 transport，
 * 触发真实的 window 信号（error / unhandledrejection / fetch），
 * 断言事件穿过完整链路落到 transport：
 *
 *   integration hook → capture → validate → integration.beforeSend
 *     → hub.applyToEvent(context + trace) → middleware → beforeSend → transport
 *
 * 落到 transport 本身就证明了每一段都放行；额外断言 context/trace/beforeSend
 * 的痕迹，证明这三段确实“做了事”，而不仅仅是“没拦下”。
 */

type Listener = (event: unknown) => void;

interface FakeWindow {
  onerror?: (
    message: unknown,
    source?: unknown,
    lineno?: unknown,
    colno?: unknown,
    error?: Error,
  ) => boolean;
  fetch: typeof fetch;
  addEventListener(type: string, cb: Listener): void;
  removeEventListener(type: string, cb: Listener): void;
  dispatchEvent(type: string, event: unknown): void;
}

const globalRef = globalThis as unknown as { window?: FakeWindow };

/** 安装最小 window 桩：覆盖三条内置插件需要的运行时表面，避免引入 jsdom。 */
function installWindow(): FakeWindow {
  const listeners: Record<string, Listener[]> = {};
  const win: FakeWindow = {
    fetch: vi.fn(async () => ({ status: 200, ok: true }) as Response),
    addEventListener(type, cb) {
      (listeners[type] ??= []).push(cb);
    },
    removeEventListener(type, cb) {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
    },
    dispatchEvent(type, event) {
      (listeners[type] ?? []).forEach((l) => l(event));
    },
  };
  globalRef.window = win;
  return win;
}

/** capture 是 fire-and-forget，pipeline 异步：刷一轮宏任务确保链路跑完。 */
const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/** 收集 transport 出口事件的假 transport。 */
function collector(): { sent: BaseEvent[]; transport: Transport } {
  const sent: BaseEvent[] = [];
  return {
    sent,
    transport: {
      send(event: BaseEvent) {
        sent.push(event);
      },
    },
  };
}

let win: FakeWindow;

beforeEach(() => {
  win = installWindow();
});

afterEach(() => {
  delete globalRef.window;
  vi.restoreAllMocks();
});

describe("web-sdk 端到端流程完整性", () => {
  it("window.onerror → error 事件穿过完整链路落到 transport", async () => {
    const { sent, transport } = collector();
    const client = initWebSDK({ transport });
    client.getScope().setUser({ id: "u1" });

    win.onerror!("boom", "app.js", 10, 5, new Error("boom"));
    await flush();

    expect(sent).toHaveLength(1);
    const event = sent[0]!;
    expect(event.type).toBe("error");
    expect(event.platform).toBe("web"); // normalize 阶段兜底
    expect((event.payload as { message: unknown }).message).toBe("boom");
    // 证明 hub.applyToEvent 真的注入了 Scope 上下文（而非仅放行）
    expect((event.context as { user?: { id: string } }).user).toEqual({
      id: "u1",
    });
  });

  it("unhandledrejection → error 事件（kind:promise）落到 transport", async () => {
    const { sent, transport } = collector();
    initWebSDK({ transport });

    win.dispatchEvent("unhandledrejection", {
      reason: new Error("rejected"),
    });
    await flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]!.type).toBe("error");
    expect(sent[0]!.payload).toMatchObject({
      kind: "promise",
      reason: "rejected",
    });
  });

  it("window.fetch → http 事件落到 transport，并带上 trace（事务已开启）", async () => {
    const { sent, transport } = collector();
    const client = initWebSDK({ transport });
    // 开启 transaction：证明 trace 注入这一段确实参与了链路
    client.getHub().startTransaction("pageload", "navigation");

    const res = await win.fetch("/api/users", { method: "post" });
    await flush();

    expect((res as Response).status).toBe(200);
    expect(sent).toHaveLength(1);
    const event = sent[0]!;
    expect(event.type).toBe("http");
    expect((event.payload as { method: string }).method).toBe("POST");
    expect(event.trace?.traceId).toBeTruthy();
  });

  it("beforeSend 改写：出口事件带上 beforeSend 的痕迹（证明该段执行）", async () => {
    const { sent, transport } = collector();
    const client = initWebSDK({
      transport,
      beforeSend: (event) => ({
        ...event,
        context: { ...event.context, tagged: true },
      }),
    });
    client.getScope().setUser({ id: "u2" });

    win.onerror!("x", "a.js", 1, 1, new Error("x"));
    await flush();

    expect(sent).toHaveLength(1);
    expect((sent[0]!.context as { tagged?: boolean }).tagged).toBe(true);
  });

  it("beforeSend 返回 null：事件在出口前被丢弃，不触达 transport", async () => {
    const { sent, transport } = collector();
    initWebSDK({ transport, beforeSend: () => null });

    win.onerror!("dropme", "a.js", 1, 1, new Error("dropme"));
    await flush();

    expect(sent).toHaveLength(0);
  });

  it("sampleRate 0：sample middleware 全量丢弃，证明 pipeline 在链路中", async () => {
    const { sent, transport } = collector();
    initWebSDK({ transport, sampleRate: 0 });

    win.onerror!("sampled-out", "a.js", 1, 1, new Error("s"));
    await flush();

    expect(sent).toHaveLength(0);
  });
});
