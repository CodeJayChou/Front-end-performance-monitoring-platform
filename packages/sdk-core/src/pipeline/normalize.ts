import type { BaseEvent } from "@monitor/event-contract";

/**
 * normalize —— pipeline 第一步。
 * 保证事件具备最小完整结构：补齐 timestamp / platform / context，
 * 使后续阶段（enrich / filter / sample）可以安全地依赖这些字段。
 */
export function normalize(event: BaseEvent, platform = "web"): BaseEvent {
  return {
    ...event,
    timestamp: event.timestamp || Date.now(),
    platform: event.platform || platform,
    context: event.context ?? {},
  };
}
