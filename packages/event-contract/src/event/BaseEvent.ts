import type { EventRuntime } from "../runtime";
import { defaultRuntime } from "../runtime";

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
 * 事件大类。列出的是平台“一等公民”类型，便于补全与归类；
 * `(string & {})` 保留扩展口子：集成可上报更细的子类型（如 "http" / "http_error"），
 * 既不丢失字面量提示，也不强行收窄到只能用这几个值。
 */
export type EventType =
  | "error"
  | "performance"
  | "behavior"
  | "custom"
  | (string & {});

/**
 * 统一事件结构 —— 整个平台的“通用语言”。
 * Core 不认识 error/performance/replay，只认识 BaseEvent。
 *
 * 泛型参数 T 约束 payload 形状：集成可声明自己的 payload 类型，
 * 默认 unknown 保持最大兼容。
 */
export interface BaseEvent<T = unknown> {
  /** 事件唯一 id */
  id: string;
  /** 事件类型，例如 "error" */
  type: EventType;
  /** 产生时间（毫秒时间戳） */
  timestamp: number;
  /** 来源端，例如 "web" */
  platform: string;
  /** 上下文：由 Hub/Scope 在进入 pipeline 前注入（user / tags / route / breadcrumbs …） */
  context: Record<string, unknown>;
  /** 链路上下文：由 Hub/Scope 在存在 transaction 时注入 */
  trace?: TraceContext;
  /** 事件载荷，结构由 type 决定 */
  payload: T;
}

/** 工厂：把任意 payload 包装成统一的 BaseEvent。 */
export function createEvent<T>(
  type: EventType,
  payload: T,
  platform = "web",
  runtime: EventRuntime = defaultRuntime,
): BaseEvent<T> {
  return {
    id: runtime.uuid(),
    type,
    timestamp: runtime.now(),
    platform,
    context: {},
    payload,
  };
}

/**
 * 事件合法性校验 —— 进入 pipeline 前的最小结构门槛。
 * 只校验“结构是否成立”，不做业务过滤（业务过滤交给 POLICY middleware）。
 *
 * 注意：只要求 normalize 阶段“补不出来”的字段——type 与 payload；
 * timestamp / platform / context 缺失由 normalize 兜底，故此处不强制。
 * 返回 false 的事件应被 Client 直接丢弃，避免脏数据污染整条链路。
 */
export function validateEvent(event: unknown): event is BaseEvent {
  if (!event || typeof event !== "object") return false;
  const e = event as Record<string, unknown>;
  return typeof e.type === "string" && e.type.length > 0 && "payload" in e;
}
