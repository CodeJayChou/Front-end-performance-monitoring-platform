import type { BaseEvent } from "@monitor/event-contract";

/**
 * Transport —— 事件出口的统一抽象。
 * Core 只依赖这个接口，不关心事件最终是打到 console、发到网络还是入队批量上报。
 * 后续 beacon / fetch / websocket 等实现都遵循它即可被 Client 直接替换。
 */
export interface Transport {
  send(event: BaseEvent): void | Promise<void>;
  /** 可选的批量出口刷新钩子；Client.close 会调用。 */
  flush?(): void | Promise<void>;
  /** 可选的生命周期关闭钩子。 */
  close?(): void | Promise<void>;
}
