import type { BaseEvent } from "@monitor/event-contract";
import { Transaction } from "@monitor/event-contract";
import type { Client } from "./Client";
import { Scope } from "./Scope";

/**
 * Hub —— 运行时上下文容器（类比 Sentry Hub）。
 *
 * 职责三件事：
 *  1. 管理 Scope 栈（push/pop 支持 modal / route 嵌套，互不污染）；
 *  2. 采集事件时用「当前 Scope」注入上下文 + trace 后交给 Client；
 *  3. 开启 Transaction 并绑定到当前 Scope，实现链路追踪。
 *
 * 一句话：Hub 管生命周期，Scope 管上下文，Transaction 管链路。
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

  /** 采集事件：当前 Scope 注入上下文 + trace 后交给 Client 处理。 */
  captureEvent(event: BaseEvent): Promise<void> {
    const finalEvent = this.getScope().applyToEvent(event);
    return this.client.capture(finalEvent);
  }

  /** 开启一个 Transaction 并绑定到当前 Scope。 */
  startTransaction(name: string, op: string): Transaction {
    const tx = new Transaction(name, op);
    this.getScope().setTransaction(tx);
    return tx;
  }
}
