import type { BaseEvent } from "./BaseEvent";

/**
 * 行为事件载荷契约 —— 用户交互信号（点击 / 路由 / 曝光 …）的统一形状。
 *
 * 设计取舍：所有行为统一挂在一等类型 `type:"behavior"` 之下，
 * 具体动作由 payload 的 `action` 字段区分。这样 Core 仍只认识 BaseEvent，
 * 行为子类型的新增不会污染顶层 EventType，也不会让 normalize/sampling 关心细分。
 */

/** 行为子类型判别字段。 */
export type BehaviorAction = "click" | "route_change" | "exposure";

/** 点击：定位被点元素 + 人类可读文本。 */
export interface ClickPayload {
  action: "click";
  /** 元素标签名（大写，如 "BUTTON"） */
  tagName: string;
  /** 元素绝对 XPath，用于唯一定位 */
  xpath: string;
  /** 元素可读文本（截断），可能不存在 */
  text?: string;
}

/** SPA 路由变化：覆盖 history 与 hash 两种模式。 */
export interface RouteChangePayload {
  action: "route_change";
  /** 变化前的完整 URL */
  from: string;
  /** 变化后的完整 URL */
  to: string;
  /** 路由模式 */
  mode: "hash" | "history";
}

/** 元素曝光：进入视口（首次）。 */
export interface ExposurePayload {
  action: "exposure";
  /** 元素标签名 */
  tagName: string;
  /** 元素绝对 XPath */
  xpath: string;
  /** 进入视口时的可见比例（0~1） */
  ratio: number;
}

/** 行为载荷联合体，由 `action` 判别。 */
export type BehaviorPayload =
  | ClickPayload
  | RouteChangePayload
  | ExposurePayload;

/** 完整行为事件：固定 `type:"behavior"`，payload 为行为载荷联合体。 */
export type BehaviorEvent = BaseEvent<BehaviorPayload> & { type: "behavior" };
