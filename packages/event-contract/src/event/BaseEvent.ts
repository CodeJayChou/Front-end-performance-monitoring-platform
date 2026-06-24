/**
 * 链路上下文 —— 把 event 关联到一次 transaction / span。
 * 由 Scope.applyToEvent 在采集时注入，用于 Performance ↔ Error 关联。
 */
export interface TraceContext {
  /** 贯穿一次 transaction 的 id */
  traceId: string;
  /** 所属 transaction id */
  transactionId: string;
  /** 当前 span id（如有） */
  spanId?: string;
}

/**
 * 统一事件结构 —— 整个平台的“通用语言”。
 * Core 不认识 error/performance/replay，只认识 BaseEvent。
 */
export interface BaseEvent {
  /** 事件唯一 id */
  id: string;
  /** 事件类型，例如 "error" */
  type: string;
  /** 产生时间（毫秒时间戳） */
  timestamp: number;
  /** 来源端，例如 "web" */
  platform: string;
  /** 上下文：由 pipeline 的 enrich 阶段从 Scope 合并进来（user / tags / route / breadcrumbs …） */
  context: Record<string, unknown>;
  /** 链路上下文：由 Hub/Scope 在存在 transaction 时注入 */
  trace?: TraceContext;
  /** 事件载荷，结构由 type 决定 */
  payload: unknown;
}

/** 工厂：把任意 payload 包装成统一的 BaseEvent。 */
export function createEvent(
  type: string,
  payload: unknown,
  platform = "web",
): BaseEvent {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    platform,
    context: {},
    payload,
  };
}
