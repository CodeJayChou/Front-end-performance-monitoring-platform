import type { BaseEvent } from "./BaseEvent";
import type { StackFrame } from "./StackFrame";

/**
 * 错误事件载荷契约 —— 各类错误信号（JS 运行时 / 资源加载 / Promise 拒绝）的统一形状。
 *
 * 设计取舍：与 BehaviorEvent（按 `action` 判别）/ PerformanceEvent（按 `metric` 判别）
 * 同构——所有错误统一挂在一等类型 `type:"error"` 之下，具体错误种类由 payload 的
 * `kind` 判别字区分。这样 Core 仍只认识 BaseEvent，错误子类型的新增不会污染顶层
 * EventType（见各事件契约一致强调的「避免顶层 EventType 爆炸」）。
 *
 * 跨平台边界（关键）：契约只承载**跨端通用核心**，沿「错误语义」这一条轴生长
 * （`kind` 增减种类），**不**沿「平台」轴堆字段——否则平台一多，payload 会被
 * 各端专属字段（web 的 tagName/domPath、native 的 viewId…）撑爆，且可选化还会
 * 抹掉类型安全。平台专属定位下沉到各自 SDK 包扩展（见 sdk-web 的
 * `WebResourceErrorPayload extends ResourceErrorPayload`）。
 *
 * 配套：`kind` 用 `(string & {})` 留开放口子（与顶层 `EventType` 同款），
 * 新平台贡献新错误种类（如 "native_crash" / "anr"）无需改动本契约。
 */

/** 错误种类判别字段；开放联合，平台可贡献新种类而不改契约。 */
export type ErrorKind = "js" | "resource" | "promise" | (string & {});

/** JS 运行时错误（window.onerror）。 */
export interface JsErrorPayload {
  kind: "js";
  /** 错误描述 */
  message: string;
  /** 出错脚本 URL */
  source?: string;
  /** 行号 */
  lineno?: number;
  /** 列号 */
  colno?: number;
  /** 调用栈原始字符串（若可得） */
  stack?: string;
  /** 归一后的结构化栈帧；由 STRUCTURAL 阶段的 stack-normalize 中间件回填 */
  stackFrames?: StackFrame[];
}

/** 资源加载错误对应的资源种类（按可观测性归一，避免逐 tagName 发散）。 */
export type ResourceType = "script" | "img" | "css" | "font" | "media" | "other";

/**
 * 资源加载错误的**跨平台核心**（script / img / css / font / media 加载失败）。
 *
 * 只含各端通用的语义字段；web 专属定位（tagName / domPath / xpath）与 Resource
 * Timing 派生字段（initiatorType…）不在此，由 sdk-web 的 `WebResourceErrorPayload`
 * 扩展承载，使本契约不随平台数量膨胀。
 */
export interface ResourceErrorPayload {
  kind: "resource";
  /** 资源 URL（已按来源解析为绝对地址；取不到时为空串） */
  url: string;
  /** 归一后的资源种类，用于聚合与告警分组 */
  resourceType: ResourceType;
  /** 错误描述（标准化文案，资源错误拿不到底层原因，统一为「加载失败」） */
  message: string;
  /** 是否跨域 / 外部资源：失败时往往指向 CDN / CORS 配置问题 */
  isCrossOrigin: boolean;
  /** 出错时所处页面 / 屏幕的标识（web 为完整 URL） */
  pageUrl: string;
}

/** 未处理的 Promise 拒绝（window 'unhandledrejection'）。 */
export interface PromiseRejectionPayload {
  kind: "promise";
  /** reject 值序列化后的描述（Error.message / string / JSON） */
  reason: string;
  /** reject 值若为 Error，保留其调用栈 */
  stack?: string;
  /** 归一后的结构化栈帧；由 STRUCTURAL 阶段的 stack-normalize 中间件回填 */
  stackFrames?: StackFrame[];
}

/** 错误载荷联合体，由 `kind` 判别。 */
export type ErrorPayload =
  | JsErrorPayload
  | ResourceErrorPayload
  | PromiseRejectionPayload;

/** 完整错误事件：固定 `type:"error"`，payload 为错误载荷联合体。 */
export type ErrorEvent = BaseEvent<ErrorPayload> & { type: "error" };

/**
 * 错误 payload 守卫 —— 进入 POLICY 阶段时按 `kind` 校验关键字段是否成形。
 *
 * 与 `validateEvent`（只查顶层 type/payload 结构）正交：这里查的是「错误语义
 * 是否可用于聚合/去重」。adapter 输出畸形载荷（如 message 丢失、url 为空）时
 * 直接拦在管线里，避免脏指纹污染 dedup / 后端聚合。
 *
 * 对开放 `kind`（平台自定义种类）只要求带非空 kind 即放行——校验责任交回贡献该
 * 种类的平台 SDK，契约层不替未知种类做强约束（与开放联合的设计一致）。
 */
export function isValidErrorPayload(payload: unknown): payload is ErrorPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.kind !== "string" || p.kind.length === 0) return false;

  switch (p.kind) {
    case "js":
      return typeof p.message === "string" && p.message.length > 0;
    case "resource":
      return typeof p.url === "string" && typeof p.resourceType === "string";
    case "promise":
      return typeof p.reason === "string";
    default:
      return true; // 开放 kind：带 kind 即放行，交由贡献方负责
  }
}
