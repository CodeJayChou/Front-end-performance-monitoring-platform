import type {
  PerformanceMetric,
  PerformanceRating,
  VitalPayload,
} from "@monitor/event-contract";

/**
 * 性能采集域内共享纯函数（类比 behavior/dom.ts）。
 * 各指标插件（FP / FCP / LCP / CLS …）复用这里的阈值评级与观测封装，避免重复。
 */

/** 各指标 good / poor 阈值（来源 web.dev Web Vitals）。≤good→good，>poor→poor，之间→needs-improvement。 */
export const VITALS_THRESHOLDS: Record<
  PerformanceMetric,
  { good: number; poor: number }
> = {
  FP: { good: 1800, poor: 3000 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
};

/** 按阈值给指标评级。 */
export function rateMetric(
  metric: PerformanceMetric,
  value: number,
): PerformanceRating {
  const { good, poor } = VITALS_THRESHOLDS[metric]!;
  if (value <= good) return "good";
  if (value > poor) return "poor";
  return "needs-improvement";
}

/** 组装一条性能指标 payload（含评级）。 */
export function toPerformancePayload(
  metric: PerformanceMetric,
  value: number,
): VitalPayload {
  return { metric, value, rating: rateMetric(metric, value) };
}

/** 当前运行时是否支持 PerformanceObserver（SSR / 老旧环境安全降级）。 */
export function supportsPerformanceObserver(): boolean {
  return (
    typeof window !== "undefined" && typeof PerformanceObserver !== "undefined"
  );
}

/**
 * 观测某类 performance entry。返回 disconnect 函数；不支持的环境返回 noop。
 * buffered:true 用于捕获 observer 注册之前已产生的条目（如首屏 paint）。
 */
export function observeEntries(
  type: string,
  onEntries: (entries: PerformanceEntry[]) => void,
): () => void {
  if (!supportsPerformanceObserver()) return () => {};
  try {
    const observer = new PerformanceObserver((list) =>
      onEntries(list.getEntries()),
    );
    observer.observe({ type, buffered: true } as PerformanceObserverInit);
    return () => observer.disconnect();
  } catch {
    // 浏览器不支持该 entryType 时忽略（不同浏览器支持度不一）
    return () => {};
  }
}

/**
 * 注册「页面隐藏即触发」回调，供 LCP / CLS 这类累积型指标定稿上报。
 * 返回解绑函数。「只触发一次」的语义由调用方用 finalized 标志保证。
 */
export function onPageHidden(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => {
    if (typeof document !== "undefined" && document.visibilityState !== "hidden")
      return;
    fn();
  };
  window.addEventListener("visibilitychange", handler, true);
  return () => window.removeEventListener("visibilitychange", handler, true);
}
