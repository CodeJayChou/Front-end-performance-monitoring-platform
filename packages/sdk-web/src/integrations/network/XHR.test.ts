import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { XHRIntegration } from "./XHR";

type Listener = () => void;

/**
 * 最小 XMLHttpRequest 桩：记录 open 入参、按事件名分发监听，手动触发 load/error
 * 模拟请求收尾，避免引入 jsdom。原型上的 open/send 会被 integration 打补丁。
 */
class FakeXHR {
  method = "";
  url = "";
  status = 0;
  private readonly listeners: Record<string, Listener[]> = {};

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  send(): void {}
  addEventListener(type: string, cb: Listener): void {
    (this.listeners[type] ??= []).push(cb);
  }
  dispatch(type: string): void {
    (this.listeners[type] ?? []).forEach((l) => l());
  }
}

const globalRef = globalThis as { XMLHttpRequest?: unknown };

function installXHR(): typeof FakeXHR {
  // 每个用例用全新的类，原型补丁不串味
  class XHR extends FakeXHR {}
  globalRef.XMLHttpRequest = XHR as unknown as typeof XMLHttpRequest;
  return XHR;
}

afterEach(() => {
  delete globalRef.XMLHttpRequest;
});

describe("XHRIntegration", () => {
  it("load（含响应）capture 一个 http 事件，携带 status / ok / duration", () => {
    const XHR = installXHR();
    const capture = vi.fn<(event: BaseEvent) => void>();
    new XHRIntegration().setup({ capture } as unknown as Client);

    const xhr = new XHR();
    xhr.open("post", "/api/users");
    xhr.send();
    xhr.status = 200;
    xhr.dispatch("load");

    expect(capture).toHaveBeenCalledTimes(1);
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

  it("4xx/5xx 仍是 http 事件，ok=false（拿到响应即视为完成）", () => {
    const XHR = installXHR();
    const capture = vi.fn<(event: BaseEvent) => void>();
    new XHRIntegration().setup({ capture } as unknown as Client);

    const xhr = new XHR();
    xhr.open("GET", "/api/missing");
    xhr.send();
    xhr.status = 404;
    xhr.dispatch("load");

    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("http");
    expect(event.payload).toMatchObject({ status: 404, ok: false });
  });

  it("网络层失败（error）capture 一个 http_error 事件", () => {
    const XHR = installXHR();
    const capture = vi.fn<(event: BaseEvent) => void>();
    new XHRIntegration().setup({ capture } as unknown as Client);

    const xhr = new XHR();
    xhr.open("GET", "/api/x");
    xhr.send();
    xhr.dispatch("error");

    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("http_error");
    expect(event.payload).toMatchObject({
      method: "GET",
      url: "/api/x",
      error: "network error",
    });
  });

  it("teardown 后还原原型 open/send", () => {
    const XHR = installXHR();
    const originalOpen = XHR.prototype.open;
    const originalSend = XHR.prototype.send;
    const integration = new XHRIntegration();
    integration.setup({ capture: vi.fn() } as unknown as Client);

    expect(XHR.prototype.open).not.toBe(originalOpen);
    integration.teardown();
    expect(XHR.prototype.open).toBe(originalOpen);
    expect(XHR.prototype.send).toBe(originalSend);
  });

  it("非浏览器环境（无 XMLHttpRequest）安全降级，不抛错", () => {
    const client = { capture: vi.fn() } as unknown as Client;
    expect(() => new XHRIntegration().setup(client)).not.toThrow();
  });
});
