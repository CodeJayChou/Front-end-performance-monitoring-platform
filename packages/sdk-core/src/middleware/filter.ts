import type { BaseEvent } from "@monitor/event-contract";
import { isValidErrorPayload } from "@monitor/event-contract";

/**
 * filter —— POLICY 阶段的「结构防污染层」。
 *
 * 两道关：
 *  1. 顶层结构：无 type 视为无效，直接丢弃。
 *  2. payload 语义：错误事件再按 `kind` 校验关键字段（message/url/reason），
 *     拦下 adapter 输出的畸形载荷，避免脏数据进入 dedup / 后端聚合。
 *
 * 只对 `type:"error"` 做 payload 级校验——其余事件类型的 payload 形状各异，
 * 由各自 adapter 负责，filter 不越权。返回 null 表示丢弃，链路就此终止。
 */
export function filter(event: BaseEvent | null): BaseEvent | null {
  if (!event || !event.type) return null;
  if (event.type === "error" && !isValidErrorPayload(event.payload)) return null;
  return event;
}
