import type { BaseEvent } from "./BaseEvent";

/**
 * 性能事件载荷契约 —— Web Vitals 指标（FP / FCP / LCP / CLS / INP / TTFB）的统一形状。
 *
 * 设计取舍：与 BehaviorEvent 同构——所有性能指标统一挂在一等类型 `type:"performance"`
 * 之下，具体指标由 payload 的 `metric` 字段区分。Core 仍只认识 BaseEvent，
 * 指标的增减不会污染顶层 EventType。
 */

/** 性能指标判别字段。 */
export type PerformanceMetric = "FP" | "FCP" | "LCP" | "CLS" | "INP" | "TTFB";

/** 指标评级（对齐 web.dev Web Vitals 的 good / needs-improvement / poor）。 */
export type PerformanceRating = "good" | "needs-improvement" | "poor";

/** 单条性能指标载荷。 */
export interface PerformancePayload {
  /** 指标名 */
  metric: PerformanceMetric;
  /** 指标值：计时类为毫秒，CLS 为无量纲分值 */
  value: number;
  /** 按阈值得出的评级 */
  rating: PerformanceRating;
}

/** 完整性能事件：固定 `type:"performance"`，payload 为单条指标载荷。 */
export type PerformanceEvent = BaseEvent<PerformancePayload> & {
  type: "performance";
};
