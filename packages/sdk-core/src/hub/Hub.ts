import type { BaseEvent } from "@monitor/event-contract";
import { Transaction } from "@monitor/event-contract";
import type { Client } from "../client/Client";
import { Scope } from "./Scope";

/**
 * Hub —— 运行时上下文容器（类比 Sentry Hub）。
 *
 * 职责三件事：
 *  1. 管理 Scope 栈（push/pop 支持 modal / route 嵌套，互不污染）；
 *  2. applyToEvent —— **全局唯一的 context/trace 注入点**（由 Client.capture 调用）；
 *  3. 开启 Transaction 并绑定到当前 Scope，实现链路追踪。
 *
 * 一句话：Hub 管生命周期，Scope 管上下文，Transaction 管链路。
 * context 单点化：Client 持有唯一的 Hub，所有采集路径都经它注入，杜绝多入口。
 */
export class Hub {
  private readonly stack: Scope[] = [];

  constructor(private readonly client: Client) {
    // 栈底始终保留一个根 Scope
    this.stack.push(new Scope());
  }

  /** 当前绑定的 Client。 */
  getClient(): Client {
    return this.client;
  }

  /** 栈顶 Scope（即“当前作用域”）。 */
  getScope(): Scope {
    return this.stack[this.stack.length - 1]!;
  }

  /** 基于当前 Scope 克隆并压栈，返回新作用域。 */
  pushScope(): Scope {
    const scope = this.getScope().clone();
    this.stack.push(scope);
    return scope;
  }

  /** 弹出栈顶 Scope（保留栈底根 Scope 不被弹出）。 */
  popScope(): Scope | undefined {
    return this.stack.length > 1 ? this.stack.pop() : undefined;
  }

  /** 在一个临时子作用域内执行回调，结束后自动还原（push → fn → pop）。 */
  withScope(fn: (scope: Scope) => void): void {
    const scope = this.pushScope();
    try {
      fn(scope);
    } finally {
      this.popScope();
    }
  }

  /** 配置当前作用域。 */
  configureScope(fn: (scope: Scope) => void): void {
    fn(this.getScope());
  }

  /**
   * 用当前 Scope 给事件注入 context + trace —— 全局唯一注入点。
   * 由 Client.capture 在 pipeline 之前调用；事件自带 context 优先级更高。
   */
  applyToEvent(event: BaseEvent): BaseEvent {
    return this.getScope().applyToEvent(event);
  }

  /**
   * 采集事件：直接转交 Client（context 注入由 Client.capture 经本 Hub 统一完成）。
   * 这里不再自行 applyToEvent，避免与 Client 形成双重注入。
   */
  captureEvent(event: BaseEvent): Promise<void> {
    return this.client.capture(event);
  }

  /** 开启一个 Transaction 并绑定到当前 Scope。 */
  startTransaction(name: string, op: string): Transaction {
    const tx = new Transaction(name, op);
    this.getScope().setTransaction(tx);
    return tx;
  }
}
