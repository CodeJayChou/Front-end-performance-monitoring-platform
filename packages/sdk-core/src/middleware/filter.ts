import type { BaseEvent } from "@monitor/event-contract";

/**
 * filter —— pipeline 第三步。
 * 丢弃结构非法的事件（无 type 视为无效）。返回 null 表示该事件被丢弃，
 * 后续阶段不再处理。后续可在此扩展更复杂的过滤规则（黑名单 / 去重等）。
 */
export function filter(event: BaseEvent | null): BaseEvent | null {
  if (!event || !event.type) return null;
  return event;
}
