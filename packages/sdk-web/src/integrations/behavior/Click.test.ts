import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { ClickIntegration } from "./Click";

type Listener = (event: unknown) => void;

// 最小 window 桩：捕获阶段监听 + 手动派发，避免引入 jsdom
const globalRef = globalThis as unknown as {
  window?: {
    addEventListener(type: string, cb: Listener, capture?: boolean): void;
    removeEventListener(type: string, cb: Listener, capture?: boolean): void;
    dispatch(type: string, event: unknown): void;
  };
};

function installWindow() {
  const listeners: Record<string, Listener[]> = {};
  globalRef.window = {
    addEventListener(type, cb) {
      (listeners[type] ??= []).push(cb);
    },
    removeEventListener(type, cb) {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
    },
    dispatch(type, event) {
      (listeners[type] ?? []).forEach((l) => l(event));
    },
  };
  return globalRef.window;
}

/** 造一个最小元素桩，满足 getXPath / getText 的只读访问。 */
function fakeEl(tagName: string, text?: string): HTMLElement {
  return {
    nodeType: 1,
    tagName,
    textContent: text,
    previousElementSibling: null,
    parentElement: null,
  } as unknown as HTMLElement;
}

afterEach(() => {
  delete globalRef.window;
});

describe("ClickIntegration", () => {
  it("点击元素 capture 一个 behavior/click 事件，带 tagName/xpath/text", () => {
    const win = installWindow();
    const capture = vi.fn<(event: BaseEvent) => void>();
    new ClickIntegration().setup({ capture } as unknown as Client);

    win.dispatch("click", { target: fakeEl("BUTTON", "  提交  ") });

    expect(capture).toHaveBeenCalledTimes(1);
    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("behavior");
    expect(event.payload).toMatchObject({
      action: "click",
      tagName: "BUTTON",
      text: "提交",
    });
    expect((event.payload as { xpath: string }).xpath).toBe("/button[1]");
  });

  it("非元素 target（nodeType !== 1）忽略，不 capture", () => {
    const win = installWindow();
    const capture = vi.fn();
    new ClickIntegration().setup({ capture } as unknown as Client);

    win.dispatch("click", { target: { nodeType: 3 } });
    expect(capture).not.toHaveBeenCalled();
  });

  it("teardown 后再点击不再 capture", () => {
    const win = installWindow();
    const capture = vi.fn();
    const integration = new ClickIntegration();
    integration.setup({ capture } as unknown as Client);
    integration.teardown();

    win.dispatch("click", { target: fakeEl("DIV") });
    expect(capture).not.toHaveBeenCalled();
  });

  it("非浏览器环境（无 window）安全降级，不抛错", () => {
    const client = { capture: vi.fn() } as unknown as Client;
    expect(() => new ClickIntegration().setup(client)).not.toThrow();
  });
});
