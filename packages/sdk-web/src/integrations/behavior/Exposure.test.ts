import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { ExposureIntegration } from "./Exposure";

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

const globalRef = globalThis as unknown as {
  window?: object;
  document?: { querySelectorAll(selector: string): HTMLElement[] };
  IntersectionObserver?: unknown;
};

/** 捕获 IntersectionObserver 回调的桩，让测试可手动触发进入视口。 */
let lastCallback: IOCallback | undefined;
let observed: HTMLElement[] = [];
let disconnected = false;

function installEnv(targets: HTMLElement[]) {
  lastCallback = undefined;
  observed = [];
  disconnected = false;
  globalRef.window = {};
  globalRef.document = {
    querySelectorAll: () => targets,
  };
  globalRef.IntersectionObserver = class {
    constructor(cb: IOCallback) {
      lastCallback = cb;
    }
    observe(el: HTMLElement) {
      observed.push(el);
    }
    disconnect() {
      disconnected = true;
    }
  };
}

function fakeEl(tagName: string): HTMLElement {
  return {
    nodeType: 1,
    tagName,
    textContent: "",
    previousElementSibling: null,
    parentElement: null,
  } as unknown as HTMLElement;
}

function entry(target: HTMLElement, isIntersecting: boolean, ratio: number) {
  return {
    target,
    isIntersecting,
    intersectionRatio: ratio,
  } as unknown as IntersectionObserverEntry;
}

afterEach(() => {
  delete globalRef.window;
  delete globalRef.document;
  delete globalRef.IntersectionObserver;
});

describe("ExposureIntegration", () => {
  it("元素进入视口 capture 一个 behavior/exposure 事件", () => {
    const el = fakeEl("IMG");
    installEnv([el]);
    const capture = vi.fn<(event: BaseEvent) => void>();
    new ExposureIntegration().setup({ capture } as unknown as Client);

    expect(observed).toEqual([el]); // setup 已 observe 命中元素
    lastCallback!([entry(el, true, 0.8)]);

    expect(capture).toHaveBeenCalledTimes(1);
    const event = capture.mock.calls[0]![0];
    expect(event.type).toBe("behavior");
    expect(event.payload).toMatchObject({
      action: "exposure",
      tagName: "IMG",
      ratio: 0.8,
    });
  });

  it("未进入视口（isIntersecting false）不上报", () => {
    const el = fakeEl("DIV");
    installEnv([el]);
    const capture = vi.fn();
    new ExposureIntegration().setup({ capture } as unknown as Client);

    lastCallback!([entry(el, false, 0)]);
    expect(capture).not.toHaveBeenCalled();
  });

  it("同一元素重复进入视口只报首次", () => {
    const el = fakeEl("SECTION");
    installEnv([el]);
    const capture = vi.fn();
    new ExposureIntegration().setup({ capture } as unknown as Client);

    lastCallback!([entry(el, true, 0.6)]);
    lastCallback!([entry(el, true, 0.9)]);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("teardown 断开 observer", () => {
    installEnv([fakeEl("DIV")]);
    const integration = new ExposureIntegration();
    integration.setup({ capture: vi.fn() } as unknown as Client);
    integration.teardown();
    expect(disconnected).toBe(true);
  });

  it("无 IntersectionObserver 时安全降级，不抛错", () => {
    globalRef.window = {};
    globalRef.document = { querySelectorAll: () => [] };
    // 不设置 IntersectionObserver
    const client = { capture: vi.fn() } as unknown as Client;
    expect(() => new ExposureIntegration().setup(client)).not.toThrow();
  });
});
