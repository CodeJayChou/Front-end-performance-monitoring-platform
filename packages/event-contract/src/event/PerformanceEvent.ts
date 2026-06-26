import type { BaseEvent } from "./BaseEvent";

/**
 * 性能事件载荷契约 —— Web Vitals 指标（FP / FCP / LCP / CLS / INP / TTFB）的统一形状。
 *
 * 设计取舍：与 BehaviorEvent 同构——所有性能指标统一挂在一等类型 `type:"performance"`
 * 之下，具体指标由 payload 的 `metric` 字段区分。Core 仍只认识 BaseEvent，
 * 指标的增减不会污染顶层 EventType。
 */

/** Web Vital 指标判别字段。 */
export type PerformanceMetric = "FP" | "FCP" | "LCP" | "CLS" | "INP" | "TTFB";

/** 指标评级（对齐 web.dev Web Vitals 的 good / needs-improvement / poor）。 */
export type PerformanceRating = "good" | "needs-improvement" | "poor";

/** 单条 Web Vital 指标载荷（单值 + 评级）。 */
export interface VitalPayload {
  /** 指标名 */
  metric: PerformanceMetric;
  /** 指标值：计时类为毫秒，CLS 为无量纲分值 */
  value: number;
  /** 按阈值得出的评级 */
  rating: PerformanceRating;
}

/**
 * Long Task 聚合载荷 —— 一次会话内所有 >50ms 主线程阻塞任务的汇总。
 *
 * Long Task 不是「一页一值带评级」的 Web Vital，而是成串出现的阻塞片段，
 * 因此单独成形：会话内累加，页面隐藏时定稿上报一条，避免逐条上报的量与噪音。
 */
export interface LongTaskPayload {
  /** 判别字：固定 "LongTask"，与 Web Vital 的 metric 字面量互斥。 */
  metric: "LongTask";
  /** long task 条数 */
  count: number;
  /** 总阻塞时长：Σ max(0, duration - 50)（毫秒），近似 TBT */
  totalBlockingTime: number;
  /** 最长单个 long task 时长（毫秒） */
  longest: number;
  /** 首个 long task 的起始时间（毫秒） */
  startTime: number;
}

/**
 * 性能事件载荷 —— Web Vital 单值 或 Long Task 聚合。
 * 以 `metric` 为判别字：`"LongTask"` → LongTaskPayload，其余 → VitalPayload。
 */
export type PerformancePayload = VitalPayload | LongTaskPayload;

/** 完整性能事件：固定 `type:"performance"`，payload 为性能载荷之一。 */
export type PerformanceEvent = BaseEvent<PerformancePayload> & {
  type: "performance";
};
