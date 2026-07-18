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
  /** 契约版本；MVP v1 默认 "1.0"，旧的本地事件可暂时缺省。 */
  schemaVersion?: "1.0" | (string & {});
  /** 事件类型，例如 "error" */
  type: EventType;
  /** 产生时间（毫秒时间戳） */
  timestamp: number;
  /** 来源端，例如 "web" */
  platform: string;
  /** 项目边界；由 Client.normalize 在 SDK 配置中补齐。 */
  projectId?: string;
  /** 页面/应用级会话标识。 */
  sessionId?: string;
  /** SDK 身份与版本。 */
  sdk?: { name: string; version: string };
  /** 运行环境，例如 development / production。 */
  environment?: string;
  /** 发布版本，用于回归分析与 SourceMap 对齐。 */
  release?: string;
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
  platformOrOptions: string | CreateEventOptions = "web",
  runtime: EventRuntime = defaultRuntime,
): BaseEvent<T> {
  const options =
    typeof platformOrOptions === "string"
      ? { platform: platformOrOptions, runtime }
      : platformOrOptions;
  const eventRuntime = options.runtime ?? defaultRuntime;
  return {
    id: eventRuntime.uuid(),
    schemaVersion: options.schemaVersion ?? "1.0",
    type,
    timestamp: eventRuntime.now(),
    platform: options.platform ?? "web",
    projectId: options.projectId,
    sessionId: options.sessionId,
    sdk: options.sdk,
    environment: options.environment,
    release: options.release,
    context: {},
    payload,
  };
}

/** createEvent 的可选元数据；保留旧的第三/第四参数形态以兼容现有插件与用户代码。 */
export interface CreateEventOptions {
  platform?: string;
  runtime?: EventRuntime;
  schemaVersion?: "1.0" | (string & {});
  projectId?: string;
  sessionId?: string;
  sdk?: { name: string; version: string };
  environment?: string;
  release?: string;
}

/**
 * 事件合法性校验 —— 进入 pipeline 前的最小结构门槛。
 * 只校验“结构是否成立”，不做业务过滤（业务过滤交给 POLICY middleware）。
 *
 * 注意：只要求 normalize 阶段“补不出来”的字段——id、type 与 payload；
 * timestamp / platform / context 缺失由 normalize 兜底，故此处不强制。
 * 返回 false 的事件应被 Client 直接丢弃，避免脏数据污染整条链路。
 */
export function validateEvent(event: unknown): event is BaseEvent {
  if (!event || typeof event !== "object") return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    e.id.length > 0 &&
    typeof e.type === "string" &&
    e.type.length > 0 &&
    "payload" in e
  );
}
