import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent, VitalPayload } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { rateMetric } from "./webVitals";
import { FCPIntegration } from "./FCP";
import { LCPIntegration } from "./LCP";
import { CLSIntegration } from "./CLS";

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

// 每个 entryType → 触发其观测回调；模拟 PerformanceObserver + 页面可见性，避免引入 jsdom
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

function emit(type: string, entries: Partial<PerformanceEntry>[]) {
  emitters[type]?.({ getEntries: () => entries as PerformanceEntry[] });
}

function hidePage() {
  globalRef.document!.visibilityState = "hidden";
  visListeners.forEach((l) => l());
}

function payloadOf(capture: ReturnType<typeof vi.fn>): VitalPayload {
  return (capture.mock.calls[0]![0] as BaseEvent).payload as VitalPayload;
}

afterEach(() => {
  delete globalRef.window;
  delete globalRef.document;
  delete globalRef.PerformanceObserver;
});

describe("rateMetric", () => {
  it("按阈值给出 good / needs-improvement / poor", () => {
    expect(rateMetric("LCP", 2000)).toBe("good");
    expect(rateMetric("LCP", 3000)).toBe("needs-improvement");
    expect(rateMetric("LCP", 5000)).toBe("poor");
    expect(rateMetric("CLS", 0.1)).toBe("good");
    expect(rateMetric("CLS", 0.3)).toBe("poor");
  });
});

describe("FCPIntegration", () => {
  beforeEach(installEnv);

  it("首个 first-contentful-paint 立即上报 performance/FCP（带评级）", () => {
    const capture = vi.fn<(e: BaseEvent) => void>();
    new FCPIntegration().setup({ capture } as unknown as Client);

    emit("paint", [{ name: "first-contentful-paint", startTime: 1000 }]);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0].type).toBe("performance");
    expect(payloadOf(capture)).toEqual({
      metric: "FCP",
      value: 1000,
      rating: "good",
    });
  });

  it("忽略 first-paint，只报 FCP", () => {
    const capture = vi.fn();
    new FCPIntegration().setup({ capture } as unknown as Client);

    emit("paint", [{ name: "first-paint", startTime: 800 }]);
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("LCPIntegration", () => {
  beforeEach(installEnv);

  it("取最后一次 LCP 值，页面隐藏时才定稿上报", () => {
    const capture = vi.fn<(e: BaseEvent) => void>();
    new LCPIntegration().setup({ capture } as unknown as Client);

    emit("largest-contentful-paint", [{ startTime: 2000 }]);
    emit("largest-contentful-paint", [{ startTime: 3200 }]);
    expect(capture).not.toHaveBeenCalled(); // 隐藏前不报

    hidePage();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(payloadOf(capture)).toEqual({
      metric: "LCP",
      value: 3200,
      rating: "needs-improvement",
    });
  });

  it("多次隐藏只定稿一次", () => {
    const capture = vi.fn();
    new LCPIntegration().setup({ capture } as unknown as Client);

    emit("largest-contentful-paint", [{ startTime: 2000 }]);
    hidePage();
    hidePage();
    expect(capture).toHaveBeenCalledTimes(1);
  });
});

describe("CLSIntegration", () => {
  beforeEach(installEnv);

  it("累加非输入引起的偏移，隐藏时上报 CLS（忽略 hadRecentInput）", () => {
    const capture = vi.fn<(e: BaseEvent) => void>();
    new CLSIntegration().setup({ capture } as unknown as Client);

    emit("layout-shift", [
      { value: 0.05, hadRecentInput: false } as unknown as PerformanceEntry,
      { value: 0.05, hadRecentInput: false } as unknown as PerformanceEntry,
      { value: 0.5, hadRecentInput: true } as unknown as PerformanceEntry,
    ]);
    hidePage();

    expect(capture).toHaveBeenCalledTimes(1);
    const payload = payloadOf(capture);
    expect(payload.metric).toBe("CLS");
    expect(payload.value).toBeCloseTo(0.1, 5);
    expect(payload.rating).toBe("good");
  });

  it("teardown 后断开观测且不再上报", () => {
    const capture = vi.fn();
    const cls = new CLSIntegration();
    cls.setup({ capture } as unknown as Client);
    cls.teardown();

    expect(disconnectSpy).toHaveBeenCalled();
    hidePage(); // teardown 已解绑 visibilitychange
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("无 PerformanceObserver 环境", () => {
  it("setup 安全降级，不抛错", () => {
    const capture = vi.fn();
    expect(() =>
      new LCPIntegration().setup({ capture } as unknown as Client),
    ).not.toThrow();
  });
});
