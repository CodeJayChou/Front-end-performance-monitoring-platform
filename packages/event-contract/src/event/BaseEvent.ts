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
  /** 事件载荷，结构由 type 决定 */
  payload: unknown;
}

/** 工厂：把任意 payload 包装成统一的 BaseEvent。 */
export function createEvent(type: string, payload: unknown): BaseEvent {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    platform: "web",
    payload,
  };
}
