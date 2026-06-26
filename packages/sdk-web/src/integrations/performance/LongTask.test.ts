import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent, LongTaskPayload } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { LongTaskIntegration } from "./LongTask";

type EntriesCb = (list: { getEntries: () => PerformanceEntry[] }) => void;
type Listener = () => void;

const globalRef = globalThis as unknown as {
  window?: {
    addEventListener(type: string, cb: Listener, capture?: boolean): void;
    removeEventListener(type: string, cb: Listener, capture?: boolean): void;
  };
  document?: { visibilityState: string };
  PerformanceObserver?: unknown;
};

// 模拟 PerformanceObserver + 页面可见性，按 entryType 触发观测回调，避免引入 jsdom
let emitters: Record<string, EntriesCb>;
let disconnectSpy: ReturnType<typeof vi.fn>;
let visListeners: Listener[];

function installEnv() {
  emitters = {};
  disconnectSpy = vi.fn();
  visListeners = [];

  class FakePerformanceObserver {
    constructor(private readonly cb: EntriesCb) {}
    observe(opts: { type: string }) {
      emitters[opts.type] = this.cb;
    }
    disconnect() {
      disconnectSpy();
    }
  }
  globalRef.PerformanceObserver =
    FakePerformanceObserver as unknown as typeof PerformanceObserver;

  globalRef.window = {
    addEventListener(type, cb) {
      if (type === "visibilitychange") visListeners.push(cb);
    },
    removeEventListener(type, cb) {
      if (type === "visibilitychange")
        visListeners = visListeners.filter((l) => l !== cb);
    },
  };
  globalRef.document = { visibilityState: "visible" };
}

function emitTasks(tasks: Partial<PerformanceEntry>[]) {
  emitters["longtask"]?.({ getEntries: () => tasks as PerformanceEntry[] });
}

function hidePage() {
  globalRef.document!.visibilityState = "hidden";
  visListeners.forEach((l) => l());
}

function payloadOf(capture: ReturnType<typeof vi.fn>): LongTaskPayload {
  return (capture.mock.calls[0]![0] as BaseEvent).payload as LongTaskPayload;
}

afterEach(() => {
  delete globalRef.window;
  delete globalRef.document;
  delete globalRef.PerformanceObserver;
});

describe("LongTaskIntegration", () => {
  beforeEach(installEnv);

  it("会话内累加，页面隐藏时定稿一条 LongTask 聚合事件", () => {
    const capture = vi.fn<(e: BaseEvent) => void>();
    new LongTaskIntegration().setup({ capture } as unknown as Client);

    emitTasks([
      { duration: 120, startTime: 3400 },
      { duration: 80, startTime: 5200 },
    ]);
    emitTasks([{ duration: 200, startTime: 8100 }]);
    expect(capture).not.toHaveBeenCalled(); // 隐藏前不报

    hidePage();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0].type).toBe("performance");
    expect(payloadOf(capture)).toEqual({
      metric: "LongTask",
      count: 3,
      // Σ max(0, dur-50) = 70 + 30 + 150
      totalBlockingTime: 250,
      longest: 200,
      startTime: 3400,
    });
  });

  it("无 long task 时不上报", () => {
    const capture = vi.fn();
    new LongTaskIntegration().setup({ capture } as unknown as Client);

    hidePage();
    expect(capture).not.toHaveBeenCalled();
  });

  it("多次隐藏只定稿一次", () => {
    const capture = vi.fn();
    new LongTaskIntegration().setup({ capture } as unknown as Client);

    emitTasks([{ duration: 120, startTime: 1000 }]);
    hidePage();
    hidePage();
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("teardown 后断开观测且不再上报", () => {
    const capture = vi.fn();
    const lt = new LongTaskIntegration();
    lt.setup({ capture } as unknown as Client);
    lt.teardown();

    expect(disconnectSpy).toHaveBeenCalled();
    hidePage(); // teardown 已解绑 visibilitychange
    expect(capture).not.toHaveBeenCalled();
  });

  it("非浏览器环境（无 PerformanceObserver）安全降级，不抛错", () => {
    delete globalRef.PerformanceObserver;
    const capture = vi.fn();
    expect(() =>
      new LongTaskIntegration().setup({ capture } as unknown as Client),
    ).not.toThrow();
  });
});
