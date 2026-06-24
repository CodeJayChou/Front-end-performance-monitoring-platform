import type { BaseEvent } from "@monitor/event-contract";

/**
 * sample —— pipeline 第四步。
 * 按采样率 rate（0~1）决定是否保留事件：未命中返回 null。
 * rate 默认 1（100% 全量上报），便于第一阶段先跑通链路。
 */
export function sample(event: BaseEvent, rate = 1): BaseEvent | null {
  if (rate >= 1) return event;
  if (rate <= 0) return null;
  return Math.random() <= rate ? event : null;
}
