import type { BaseEvent, Transaction } from "@monitor/event-contract";
import type { Client } from "../client/Client";
import type { Hub } from "./Hub";
import type { Scope } from "./Scope";

/**
 * Monitor —— 全局入口门面（类比 Sentry 命名空间 API）。
 * 在 Hub 之上提供最常用的几个动作，业务侧不必直接接触 Hub。
 *
 * 复用 Client 持有的唯一 Hub（不再另建），保证 Monitor 与 client.capture
 * 共享同一套 Scope 栈 —— context 单点化。
 */
export class Monitor {
  readonly hub: Hub;

  constructor(client: Client) {
    this.hub = client.getHub();
  }

  /** 采集事件（自动注入当前 Scope 的上下文 + trace）。 */
  capture(event: BaseEvent): Promise<void> {
    return this.hub.captureEvent(event);
  }

  /** 配置当前全局作用域。 */
  configureScope(fn: (scope: Scope) => void): void {
    this.hub.configureScope(fn);
  }

  /** 在临时子作用域内执行（互不污染）。 */
  withScope(fn: (scope: Scope) => void): void {
    this.hub.withScope(fn);
  }

  /** 开启一次链路追踪事务。 */
  startTransaction(name: string, op: string): Transaction {
    return this.hub.startTransaction(name, op);
  }
}
