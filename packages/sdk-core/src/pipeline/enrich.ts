import type { BaseEvent } from "@monitor/event-contract";
import type { Scope } from "../client/Scope";

/**
 * enrich —— pipeline 第二步。
 * 把 Scope 中的公共上下文（user / tags / route / breadcrumbs）合并进事件。
 * 事件自带的 context 优先级更高，不会被 Scope 覆盖。
 */
export function enrich(event: BaseEvent, scope: Scope): BaseEvent {
  return {
    ...event,
    context: {
      ...scope.getContext(),
      ...event.context,
    },
  };
}
