# SDK 架构现状（重构后 · 单一事实来源）

> 本文是「架构去冗余重构」落地后的**权威现状快照**，用于对齐 / 喂 GPT。
> 与早期草图（`SDK Pipeline.md` / `SDK Core Pipeline.md`）冲突时**一律以本文为准**；
> 冻结/废弃清单见 `deprecated.md`，历史差异见 `项目现状校对（Ground Truth）.md`。
>
> 核对方式：逐文件读源码。验证状态：`tsc` 0 错、`vitest` 55 passed、`eslint` 0 错、`turbo build` 13/13。
> 最后更新：2026-06-25。

---

## 1. 顶层形态

- Monorepo（pnpm + turbo），包前缀 `@monitor/*`。
- 单向数据流 + 强契约 + 可插拔：`Integration → Client → Hub/Scope → Middleware → beforeSend → Transport`。
- **Client 是唯一调度入口**：只有 `Client.capture()` 能触发事件流；分层不得相互穿透（ESLint enforce）。

现有包：

| 包 | 职责 | 状态 |
|---|---|---|
| `@monitor/event-contract` | 事件契约 + Trace 模型 | ✅ |
| `@monitor/sdk-core` | 调度核心（client / hub / middleware / transport / integration） | ✅ |
| `@monitor/sdk-web` | Web 平台采集插件 | 🟡 部分 |
| `@monitor/sdk-react` / `@monitor/sdk-vue` | 框架适配 | ⬜ 空壳 |
| `@monitor/shared` | 公共工具 | ⬜ 空壳 |

> 已删除：`@monitor/types`、`@monitor/transport`（空壳包）；`EventDispatcher/Factory/Processor`（空壳）；`pipeline/enrich.ts`（scope 版）。

---

## 2. 目录结构（sdk-core 已锁定为 5 目录）

```
packages/sdk-core/src/
  client/        Client.ts            ← 唯一调度入口
  hub/           Hub.ts Scope.ts Monitor.ts   ← 上下文 + trace + 门面
  middleware/    MiddlewarePipeline.ts builtins.ts contextMiddleware.ts
                 normalize.ts filter.ts sampling.ts   ← 洋葱模型
  transport/     Transport.ts ConsoleTransport.ts HttpTransport.ts   ← IO 层
  integration/   Integration.ts IntegrationManager.ts registry.ts DynamicLoader.ts
  index.ts       ← 唯一 barrel 出口
```

---

## 3. 核心数据流

```
Integration（采集）  →  Client.capture(event)
                          │
                          ├─ 0. validateEvent(event)            结构门槛，脏数据直接丢
                          ├─ 1. integration.beforeSend(event)   各插件同步增强 / 丢弃(null)
                          ├─ 2. hub.applyToEvent(event)         注入 context + trace（唯一注入点，pipeline 之前）
                          ├─ 3. MiddlewarePipeline.execute()    STRUCTURAL→CONTEXTUAL→POLICY
                          │        normalize → context → filter → sample → 自定义
                          ├─ 4. beforeSend(event)               最终拦截
                          └─ 5. transport.send(event)           Console / Http / 自定义
```

**两条采集路径，共享同一套 Scope**（context 单点）：
- 直采：`client.capture(event)`。
- 链路追踪：`Monitor.capture → Hub.captureEvent → client.capture` —— `Monitor` 复用 `client.getHub()`，不另建 Hub。

> 关键规则：
> - **context 单点**：`Client` 持有唯一的 `Hub`；`client.scope` / `getScope()` 都委托到它。`hub.applyToEvent` 是**全局唯一**的 context/trace 注入点，杜绝多入口 / 双重注入。
> - **scope merge 只发生在 pipeline 之前**（步骤 2），middleware 内不得再做 scope 合并。

---

## 4. Event Contract（`@monitor/event-contract`）

```ts
type EventType = "error" | "performance" | "behavior" | "custom" | (string & {});

interface BaseEvent<T = unknown> {
  id: string;
  type: EventType;                    // 四个一等公民 + 允许集成上报细分类型（如 "http"）
  timestamp: number;
  platform: string;
  context: Record<string, unknown>;   // 由 Scope 在 pipeline 之前注入
  trace?: TraceContext;               // 有 transaction 时注入
  payload: T;                         // 泛型，结构由 type 决定
}

createEvent<T>(type, payload, platform = "web"): BaseEvent<T>   // 工厂
validateEvent(event): event is BaseEvent                       // 仅校验 type(非空) + payload 存在
```

- `EventType` 用 `(string & {})` 收口：四个类型有补全提示，又不阻止 `"http"` / `"promise_rejection"` 等存量细分类型。
- `validateEvent` 只卡 normalize **补不出来**的字段（type / payload）；timestamp / platform / context 缺失由 normalize 兜底。
- Trace 模型：`Transaction`（= traceId）持有多个 `Span`，用于 Performance ↔ Error 关联。

---

## 5. Middleware 系统（`middleware/`）

```ts
enum MiddlewareType { STRUCTURAL = "structural", CONTEXTUAL = "contextual", POLICY = "policy" }

interface Middleware {
  name: string;
  type?: MiddlewareType;   // 缺省视为 CONTEXTUAL
  priority?: number;       // 同阶段内降序；缺省 0
  handle(event, next): Promise<BaseEvent | null>;   // return null 即短路丢弃
}
```

- **执行顺序 = 阶段序 → priority 降序**：`STRUCTURAL → CONTEXTUAL → POLICY`，同阶段按 priority 大→小，V8 稳定排序保留注册先后。
- 默认链（Client 构造时装配）：

| middleware | type | priority | 作用 |
|---|---|---|---|
| `normalize` | STRUCTURAL | 100 | 补齐 timestamp / platform / context |
| `context` | CONTEXTUAL | — | 注入运行时 url / userAgent（浏览器外安全降级） |
| `filter` | POLICY | 80 | 丢弃结构非法事件 |
| `sample` | POLICY | 70 | 按采样率保留 |

- 自定义接入：`client.addMiddleware(mw)`，按 type/priority 自动插入正确位置。
- 调试钩子：`MiddlewarePipeline(tap?)`，每个 middleware 执行前回调（debug 模式注入）。

---

## 6. Hub / Scope / Monitor（`hub/`）

- **Scope**：可变上下文容器（user / tags / route / breadcrumbs / context / transaction）。
  `getContext()` 出上下文快照，`applyToEvent()` 注入 context + trace，`clone()` 供栈隔离。
- **Hub**：Scope 栈管理器（push / pop / withScope / configureScope）+ `startTransaction()` + **`applyToEvent()`（唯一 context 注入点，由 Client.capture 调用）**。`captureEvent()` 只是转交 `client.capture`，不再自行注入（避免双重注入）。
- **Client 持有唯一 Hub**：`new Hub(this)`；`client.getHub()` 暴露给 Monitor 复用，`client.scope` / `getScope()` 委托到 `hub.getScope()`。
- **Monitor**：全局门面，构造时 `client.getHub()` **复用**同一 Hub（不另建），在其上暴露 capture / withScope / startTransaction。

---

## 7. Transport（`transport/`）

```ts
interface Transport { send(event: BaseEvent): void | Promise<void>; }
```

- `ConsoleTransport`：默认出口，打 `console.log`，本地验证链路。
- `HttpTransport`（生产级）：`fetch` POST，能力——
  - `keepalive`（默认 true）：页面卸载仍尽力送达；
  - **重试**：失败按 `maxRetries`（默认 2，共 3 次尝试）；
  - **sendBeacon 兜底**：全部重试失败 / 无 fetch 时退化到 `navigator.sendBeacon`；
  - 吞掉所有网络异常，绝不抛回宿主应用。
- **出口选择**（`init`）：显式 `transport` > 有 `dsn` → `HttpTransport` > 默认 `ConsoleTransport`。

---

## 8. Integration 系统（`integration/`）

```ts
interface Integration {
  name: string;
  setup(client: Client): void;            // 安装 runtime hooks
  beforeSend?(event): BaseEvent | null;   // 进 pipeline 前增强 / 丢弃
  teardown?(): void;                      // 还原 hooks（解绑 / 还原被 patch 的全局）
}
```

- 生命周期：`setup` → 运行期 `beforeSend` → `teardown`。`Client.close()` 统一调用所有 `teardown`。
- 约束：插件**不得绕过 middleware**，**不得直接操作 transport**——采集只能 `client.capture()`。
- 运行时可扩展：`IntegrationRegistry.register(name, factory)` 登记，`DynamicLoader.enable(name)` 按需开启。
- 已实现的 Web 插件：`GlobalError`、`PromiseRejection`、`Fetch`（均含 teardown）。

---

## 9. 调试 / 观测

- `init({ debug: true })` 或 `new Client({ debug })`：打印事件流 `[SDK FLOW] <stage>`，覆盖
  `drop:invalid / drop:<integration> / scope / middleware:<name> / transport`。非 debug 零开销。

---

## 10. 架构边界（ESLint enforce）

- 只有 `Client` 编排 pipeline / transport。
- `transport/**` ✗ import `middleware/**`；`middleware/**` ✗ import `transport/**`；
  `integration(s)/**` ✗ import `transport/**`。
- 禁止重新引入已删包 `@monitor/types` / `@monitor/transport`。
- 测试文件放宽以便白盒测试。

---

## 11. 扩展姿势（正确做法）

| 想做 | 怎么做 | 不要 |
|---|---|---|
| 加采集能力 | 新建 `class XxxIntegration implements Integration`，`setup` 装 hook，调 `client.capture(createEvent(...))` | 改 core / 直连 transport |
| 加处理逻辑 | 写 `Middleware`（带 type/priority），`client.addMiddleware()` | 在 middleware 内做 scope merge |
| 换 / 加出口 | 实现 `Transport.send`，`init({ transport })` | 在 integration 里直发 |
| 链路追踪 | `Monitor.startTransaction → tx.startSpan`，走 Hub 路径 | — |
| 上报地址 | `init({ dsn })` 自动用 HttpTransport | 手写 fetch |

---

## 12. 待办（重构未覆盖、建议后续聚焦）

性能采集（FP/FCP/LCP/CLS/INP）、行为采集（Click/Exposure/Route）、ResourceError / XHR、
回放（rrweb 思路）、React / Vue 适配层、事件类型细分（ErrorEvent…）、Session 管理、
Transport 批量 / 离线队列、后端 ingest 服务 + 控制台前端——**以上目前为空壳或未建**。
