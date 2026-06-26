import type { BaseEvent, EventRuntime, Transaction } from "@monitor/event-contract";
import { defaultRuntime } from "@monitor/event-contract";

/**
 * Scope —— 上下文容器（类似 Sentry Scope）。
 *
 * 它独立于具体事件，持有“当前这次会话/页面/异步链路”的附加维度：
 * user / tags / route / breadcrumbs / context / transaction。
 * 两种用法：
 *  - pipeline 的 enrich 阶段读取 getContext() 把公共上下文合并进事件；
 *  - Hub 通过 clone() 维护可 push/pop 的 Scope 栈，applyToEvent() 注入上下文 + trace。
 */
export interface Breadcrumb {
  /** 行为描述，例如 "click #submit" */
  message: string;
  /** 发生时间（毫秒时间戳） */
  timestamp: number;
}

export class Scope {
  private user?: unknown;
  private tags: Record<string, string> = {};
  private context: Record<string, unknown> = {};
  private breadcrumbs: Breadcrumb[] = [];
  private route?: string;
  private transaction?: Transaction;

  /** 时间原语来源；由 Hub 注入，clone 时透传，保证全链路同一时钟。 */
  constructor(private readonly runtime: EventRuntime = defaultRuntime) {}

  /** 设置当前用户信息。 */
  setUser(user: unknown): this {
    this.user = user;
    return this;
  }

  /** 设置一个标签（可检索维度）。 */
  setTag(key: string, value: string): this {
    this.tags[key] = value;
    return this;
  }

  /** 写入一条自定义上下文。 */
  setContext(key: string, value: unknown): this {
    this.context[key] = value;
    return this;
  }

  /** 记录当前路由。 */
  setRoute(route: string): this {
    this.route = route;
    return this;
  }

  /** 追加一条行为面包屑（用于还原错误发生前的操作链路）。 */
  addBreadcrumb(message: string): this {
    this.breadcrumbs.push({ message, timestamp: this.runtime.now() });
    return this;
  }

  /** 绑定当前链路追踪事务。 */
  setTransaction(transaction: Transaction): this {
    this.transaction = transaction;
    return this;
  }

  /** 读取当前绑定的 transaction。 */
  getTransaction(): Transaction | undefined {
    return this.transaction;
  }

  /**
   * 读取当前上下文快照（浅拷贝）。仅包含已设置的维度，
   * 供 pipeline 的 enrich 阶段合并进事件。
   */
  getContext(): Record<string, unknown> {
    return {
      ...this.context,
      ...(this.user !== undefined ? { user: this.user } : {}),
      ...(Object.keys(this.tags).length ? { tags: { ...this.tags } } : {}),
      ...(this.route !== undefined ? { route: this.route } : {}),
      ...(this.breadcrumbs.length ? { breadcrumbs: [...this.breadcrumbs] } : {}),
    };
  }

  /**
   * 把本 Scope 的上下文 + trace 注入事件（Hub 采集路径使用）。
   * 事件自带的 context 优先级更高，不会被 Scope 覆盖。
   */
  applyToEvent(event: BaseEvent): BaseEvent {
    const enriched: BaseEvent = {
      ...event,
      context: { ...this.getContext(), ...event.context },
    };

    if (this.transaction) {
      enriched.trace = {
        traceId: this.transaction.id,
        transactionId: this.transaction.id,
        spanId: this.transaction.getActiveSpan()?.id,
      };
    }

    return enriched;
  }

  /** 复制出一份独立 Scope（供 Hub push 嵌套作用域；transaction 引用共享）。 */
  clone(): Scope {
    const cloned = new Scope(this.runtime);
    cloned.user = this.user;
    cloned.tags = { ...this.tags };
    cloned.context = { ...this.context };
    cloned.breadcrumbs = [...this.breadcrumbs];
    cloned.route = this.route;
    cloned.transaction = this.transaction;
    return cloned;
  }

  /** 清空上下文（例如用户登出 / 会话结束）。 */
  clear(): void {
    this.user = undefined;
    this.tags = {};
    this.context = {};
    this.breadcrumbs = [];
    this.route = undefined;
    this.transaction = undefined;
  }
}
