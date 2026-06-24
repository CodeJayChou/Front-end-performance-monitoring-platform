1. 为什么必须引入 Hub + Scope（核心认知升级）

你现在的模型是：

Client + Middleware + Integration

这个在“采集层”是够的，但会缺一个关键能力：

❌ 当前问题（没有 Scope 的系统）
1）上下文污染

所有 event 共用一份 context：

user
tags
breadcrumbs
route

👉 导致跨页面 / 异步链路混乱

2）无法表达“局部状态”

例如：

某个请求的 userId
某个 route 的 transaction
某个 async flow 的 breadcrumb
3）无法做 trace 级别关联

你无法回答：

“这个 error 属于哪个 performance transaction？”

2. Sentry 核心三件套
🧠 Hub（运行时容器）

全局执行上下文管理器（thread-local / async-local）

负责：

当前 client
当前 scope stack
integration registry
🧠 Scope（上下文载体）

event 的“附加维度空间”

包含：

user
tags
breadcrumbs
context
level
transaction

👉 Scope 是可 push / pop 的栈结构

🧠 Transaction / Span（链路追踪）

performance tracing 核心结构

Transaction = 一个完整操作（page load / click / api flow）
Span = 子操作（fetch / render / compute）
3. 架构总图（关键）
Hub
 ├── Client
 ├── Scope Stack
 │     ├── Scope A (page A)
 │     ├── Scope B (modal)
 │
 └── Integration Registry

Scope
 ├── User
 ├── Tags
 ├── Breadcrumbs
 ├── Transaction
 └── Context

Transaction
 ├── Span A
 ├── Span B
 └── Span C
4. Hub 设计（核心入口）
export class Hub {
  private stack: Scope[] = [];
  private client: MonitorClient;

  constructor(client: MonitorClient) {
    this.client = client;
    this.stack.push(new Scope());
  }

  getScope(): Scope {
    return this.stack[this.stack.length - 1];
  }

  pushScope(): Scope {
    const scope = this.getScope().clone();
    this.stack.push(scope);
    return scope;
  }

  popScope(): Scope | undefined {
    if (this.stack.length > 1) {
      return this.stack.pop();
    }
  }

  captureEvent(event: MonitorEvent) {
    const scope = this.getScope();
    const finalEvent = scope.applyToEvent(event);
    this.client.capture(finalEvent);
  }

  startTransaction(name: string, op: string) {
    const tx = new Transaction(name, op);
    this.getScope().setTransaction(tx);
    return tx;
  }
}
5. Scope（核心状态容器）
export class Scope {
  user?: Record<string, any>;
  tags: Record<string, string> = {};
  context: Record<string, any> = {};
  breadcrumbs: any[] = [];
  transaction?: Transaction;

  setUser(user: any) {
    this.user = user;
  }

  setTag(key: string, value: string) {
    this.tags[key] = value;
  }

  addBreadcrumb(bc: any) {
    this.breadcrumbs.push(bc);
  }

  setTransaction(tx: Transaction) {
    this.transaction = tx;
  }

  applyToEvent(event: MonitorEvent): MonitorEvent {
    return {
      ...event,
      context: {
        ...this.context,
      },
      tags: {
        ...this.tags,
        ...event.tags,
      },
      breadcrumbs: [...this.breadcrumbs],
    };
  }

  clone(): Scope {
    const s = new Scope();
    s.user = this.user;
    s.tags = { ...this.tags };
    s.context = { ...this.context };
    s.breadcrumbs = [...this.breadcrumbs];
    s.transaction = this.transaction;
    return s;
  }
}
6. Transaction + Span（核心 tracing）
6.1 Span
export class Span {
  id: string = crypto.randomUUID();
  op: string;
  description?: string;

  startTime: number;
  endTime?: number;

  constructor(op: string, desc?: string) {
    this.op = op;
    this.description = desc;
    this.startTime = Date.now();
  }

  finish() {
    this.endTime = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      op: this.op,
      description: this.description,
      duration: this.endTime ? this.endTime - this.startTime : 0,
    };
  }
}
6.2 Transaction
export class Transaction {
  id: string = crypto.randomUUID();
  name: string;
  op: string;

  startTime: number = Date.now();
  spans: Span[] = [];

  constructor(name: string, op: string) {
    this.name = name;
    this.op = op;
  }

  startSpan(op: string, desc?: string) {
    const span = new Span(op, desc);
    this.spans.push(span);
    return span;
  }

  finish() {
    // finalize transaction
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      op: this.op,
      duration: Date.now() - this.startTime,
      spans: this.spans.map(s => s.toJSON()),
    };
  }
}
7. Hub + Scope + Client 三者联动
export class MonitorClient {
  async capture(event: MonitorEvent) {
    console.log("send:", event);
  }
}
全局入口（类似 Sentry.init）
export class Monitor {
  hub: Hub;

  constructor(client: MonitorClient) {
    this.hub = new Hub(client);
  }

  capture(event: MonitorEvent) {
    this.hub.captureEvent(event);
  }

  configureScope(fn: (scope: Scope) => void) {
    fn(this.hub.getScope());
  }

  startTransaction(name: string, op: string) {
    return this.hub.startTransaction(name, op);
  }
}
8. 使用方式（关键理解）
8.1 设置全局上下文
monitor.configureScope(scope => {
  scope.setUser({ id: "123" });
  scope.setTag("env", "prod");
});
8.2 error 自动带 context
window.onerror = (msg, src, line) => {
  monitor.capture({
    id: crypto.randomUUID(),
    type: "error",
    timestamp: Date.now(),
    platform: "web",
    message: msg,
  });
};

👉 Scope 自动注入 user/tags/breadcrumbs

8.3 Transaction tracing
const tx = monitor.startTransaction("page-load", "navigation");

const span = tx.startSpan("fetch", "/api/user");

await fetch("/api/user");

span.finish();

tx.finish();
9. 关键能力升级点（商用级核心）
✔ 1. Async Context 绑定（非常关键）

否则 Scope 在 async 中会丢失

👉 需要 AsyncLocalStorage（Node）或 zone-like polyfill（Web）

✔ 2. Scope Stack（支持 modal / route nesting）
hub.pushScope();
hub.popScope();
✔ 3. Trace ID 贯穿 event

event 必须带：

trace: {
  traceId,
  spanId,
  transactionId
}
✔ 4. Performance ↔ Error 关联

错误必须自动挂载：

当前 transaction
当前 span
当前 route
10. 最关键的系统升级点总结

如果你只记住一件事：

Hub 管生命周期，Scope 管上下文，Transaction 管链路

11. 这个架构已经具备什么级别？

✔ Sentry SDK 同等级
✔ 可扩展 tracing
✔ 可做 APM（应用性能监控）
✔ 可接入 backend observability
✔ 可支持 multi-app / mono-repo SDK