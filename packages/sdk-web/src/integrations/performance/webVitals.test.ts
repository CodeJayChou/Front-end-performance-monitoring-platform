import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent, VitalPayload } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import { rateMetric } from "./webVitals";
import { FCPIntegration } from "./FCP";
import { LCPIntegration } from "./LCP";
import { CLSIntegration } from "./CLS";

const onLCP = vi.hoisted(() => vi.fn());
const onCLS = vi.hoisted(() => vi.fn());
vi.mock("web-vitals", () => ({ onLCP, onCLS }));

type EntriesCb = (list: { getEntries: () => PerformanceEntry[] }) => void;

const globalRef = globalThis as unknown as {
  window?: object;
  document?: { visibilityState: string };
  PerformanceObserver?: unknown;
};

// 每个 entryType → 触发其观测回调；模拟 PerformanceObserver + 页面可见性，避免引入 jsdom
let emitters: Record<string, EntriesCb>;
let disconnectSpy: ReturnType<typeof vi.fn>;

function installEnv() {
  onLCP.mockClear();
  onCLS.mockClear();
  emitters = {};
  disconnectSpy = vi.fn();

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

  globalRef.window = {};
  globalRef.document = { visibilityState: "visible" };
}

function emit(type: string, entries: Partial<PerformanceEntry>[]) {
  emitters[type]?.({ getEntries: () => entries as PerformanceEntry[] });
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

  it("uses the final web-vitals value and emits it once", () => {
    const capture = vi.fn<(e: BaseEvent) => void>();
    const lcp = new LCPIntegration();
    lcp.setup({ capture } as unknown as Client);

    expect(onLCP).toHaveBeenCalledTimes(1);
    const report = onLCP.mock.calls[0]![0] as (metric: { value: number }) => void;
    report({ value: 3200 });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(payloadOf(capture)).toEqual({
      metric: "LCP",
      value: 3200,
      rating: "needs-improvement",
    });

    lcp.teardown();
  });

  it("does not emit after teardown", () => {
    const capture = vi.fn();
    const lcp = new LCPIntegration();
    lcp.setup({ capture } as unknown as Client);
    const report = onLCP.mock.calls[0]![0] as (metric: { value: number }) => void;
    lcp.teardown();
    report({ value: 2000 });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("CLSIntegration", () => {
  beforeEach(installEnv);

  it("uses web-vitals session-window CLS value", () => {
    const capture = vi.fn<(e: BaseEvent) => void>();
    const cls = new CLSIntegration();
    cls.setup({ capture } as unknown as Client);

    expect(onCLS).toHaveBeenCalledTimes(1);
    const report = onCLS.mock.calls[0]![0] as (metric: { value: number }) => void;
    report({ value: 0.1 });

    expect(capture).toHaveBeenCalledTimes(1);
    const payload = payloadOf(capture);
    expect(payload.metric).toBe("CLS");
    expect(payload.value).toBeCloseTo(0.1, 5);
    expect(payload.rating).toBe("good");
    cls.teardown();
  });

  it("teardown 后不再上报", () => {
    const capture = vi.fn();
    const cls = new CLSIntegration();
    cls.setup({ capture } as unknown as Client);
    const report = onCLS.mock.calls[0]![0] as (metric: { value: number }) => void;
    cls.teardown();
    report({ value: 0.3 });
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
