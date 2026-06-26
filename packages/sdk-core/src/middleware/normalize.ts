import type { BaseEvent, EventRuntime } from "@monitor/event-contract";
import { defaultRuntime } from "@monitor/event-contract";

/**
 * normalize —— pipeline 第一步。
 * 保证事件具备最小完整结构：补齐 timestamp / platform / context，
 * 使后续阶段（enrich / filter / sample）可以安全地依赖这些字段。
 *
 * 时间戳兜底走注入的 runtime，不再硬编码 `Date.now()`。
 */
export function normalize(
  event: BaseEvent,
  platform = "web",
  runtime: EventRuntime = defaultRuntime,
): BaseEvent {
  return {
    ...event,
    timestamp: event.timestamp || runtime.now(),
    platform: event.platform || platform,
    context: event.context ?? {},
  };
}
