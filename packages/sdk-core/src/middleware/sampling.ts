import type { BaseEvent } from "@monitor/event-contract";
import { fnv1a } from "../util/hash";

/**
 * sample —— pipeline 第四步。
 * 按采样率 rate（0~1）决定是否保留事件：未命中返回 null。
 * rate 默认 1（100% 全量上报），便于第一阶段先跑通链路。
 */
export function sample(event: BaseEvent, rate = 1, seed = event.id): BaseEvent | null {
  if (rate >= 1) return event;
  if (rate <= 0) return null;
  // 稳定采样：同一 session + 事件大类在相同 rate 下保持一致，避免一条错误
  // 的首次事件被采样丢弃后，后续重复事件又全部被 dedup 丢掉。
  const bucket = Number.parseInt(fnv1a(`${seed}:${event.type}`), 36) / 0xffffffff;
  return bucket <= rate ? event : null;
}
