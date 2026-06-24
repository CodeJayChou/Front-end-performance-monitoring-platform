# 项目现状校对（Ground Truth）

> 📌 **本文已被 `SDK 架构现状（重构后）.md` 取代为权威现状**。下方正文是「架构去冗余重构」**之前**的快照，保留作历史对照（解释设计稿 → 旧实现的信息差）。看当前架构请直接读那份。
>
> 用途（历史）：把"设计文档里写的"和"代码里真实实现的"对齐。两份设计稿（`SDK Pipeline.md` / `SDK Core Pipeline.md`）是**早期草图**。
>
> 最后核对时间：2026-06-25。核对方式：逐文件读源码（非凭记忆）。

> ⚠️ **2026-06-25 架构去冗余重构已落地**（依据 `架构去冗余重构.md`，冻结清单见 `deprecated.md`）。本文下方部分细节为重构前快照，**以下变更以重构为准**：
> - **已删除**：`packages/types`、`packages/transport` 两个空壳包（类型在 `@monitor/event-contract`，transport 在 `@monitor/sdk-core/transport`）；`sdk-core/src/event/EventDispatcher|Factory|Processor` 空壳；`pipeline/enrich.ts`（scope 版）。
> - **Pipeline 阶段化**：middleware 新增 `MiddlewareType`（STRUCTURAL→CONTEXTUAL→POLICY），排序先按阶段再按 priority。默认链：`normalize → context → filter → sample`。
> - **Scope 收敛**：scope merge 移出 middleware，改在 `Client.capture` 内、pipeline **之前**由 `Scope.applyToEvent` 注入。
> - **Event Contract 稳定化**：`BaseEvent<T>` 泛型 payload；`EventType = "error"|"performance"|"behavior"|"custom"|(string&{})`；新增 `validateEvent`，capture 前置校验。
> - **Transport 加固**：`HttpTransport` 增加重试（默认共 3 次）+ `sendBeacon` 兜底。
> - **Integration 生命周期**：新增 `teardown?()`，`Client.close()` 统一卸载；新增 `debug` 事件流日志。
> - **边界 enforce**：ESLint 拦截 transport↔middleware、integration→transport 的跨层 import，并禁止重新引入已删包。

---

## 0. 一句话现状

- **Monorepo（pnpm + turbo）**，包前缀统一为 `@monitor/*`。
- **核心数据流已跑通**：`event → 集成钩子 → middleware pipeline（normalize→enrich→filter→sample）→ beforeSend → transport`。
- **已落地**：Event Contract、洋葱模型 Pipeline、Hub/Scope/Monitor、Trace（Transaction/Span）、Integration 插件系统、ConsoleTransport + HttpTransport。
- **大量空壳文件**（0 行）：performance / replay / behavior 采集、sdk-react、sdk-vue、`@monitor/types`、`@monitor/transport`、`@monitor/shared` 等都还没写。

---

## 1. ⚠️ 设计稿 vs 真实代码：关键信息差（最容易让人跑偏的点）

| 主题 | 设计稿（旧，**勿照抄**） | 真实代码（**以此为准**） |
|---|---|---|
| **类型包** | 从 `@monitor/types` 引 `BaseEvent` | 类型在 **`@monitor/event-contract`**。`packages/types` 是**空壳包**，不要往里加东西，也不要从它 import |
| **传输包** | 从 `@monitor/transport` 引 `Transport` | Transport 在 **`@monitor/sdk-core/src/transport`**。`packages/transport` 是**空壳包** |
| **事件结构** | `BaseEvent` 有 `name` 字段；另有 `EnrichedEvent` | **没有 `name` 字段**，**没有 `EnrichedEvent` 类型**。只有一个 `BaseEvent`，上下文放在 `context`，链路放在可选 `trace` |
| **管道模型** | 线性 `SDKCorePipeline` + `PipelineStage{ run() }`，循环依次调用 | **Koa 洋葱模型** `MiddlewarePipeline` + `Middleware{ handle(event, next) }`，支持 `priority` 排序 + 任意层 `return null` 短路。**不存在 `SDKCorePipeline`/`PipelineStage`** |
| **stage 写法** | 导出 `normalizeStage` 等对象常量 | 导出纯函数 `normalize/enrich/filter/sample` + 工厂 `createXxxMiddleware()`。纯函数做逻辑，middleware 负责接进链路 |
| **dispatch** | 用 `dispatchStage(transport)` 当作管道最后一环 | **transport 不是 stage**。它是 `Client` 的字段，pipeline 跑完后由 `Client.capture` 调 `transport.send` |
| **入口** | `initSDK()` 内部 new 死一个 Transport | `init(options)`（core）/ `initWebSDK(options)`（web）。transport 由配置决定：显式 `transport` > 有 `dsn` 走 `HttpTransport` > 默认 `ConsoleTransport` |
| **采样默认值** | `rate = 0.5` | 默认 `sampleRate = 1`（全量），第一阶段先跑通 |
| **上下文来源** | 写死 `window.location` 等 | 主要来自 **Scope**（user/tags/route/breadcrumbs）；`window/navigator` 由可选的 `contextMiddleware` 注入，且事件自带 `context` 优先级更高 |

> 给 GPT 的硬性提醒：**不要建议引入 `SDKCorePipeline`、`PipelineStage`、`EnrichedEvent`、`name` 字段，或从 `@monitor/types`/`@monitor/transport` 导入**——这些都会和现有架构冲突或制造重复实现。

---

## 2. 真实架构与数据流

```
平台采集层（Integration）            核心层（@monitor/sdk-core）                出口层
window.onerror / fetch / ...  ──►  Client.capture(event)
                                      │
                                      ├─ 1. integration.beforeSend(event)   每个插件可同步改写/丢弃（null）
                                      ├─ 2. MiddlewarePipeline.execute()    洋葱链，按 priority 降序：
                                      │       normalize(100) → enrich(90) → filter(80) → sample(70) → 自定义
                                      │       任意层 return null 即终止
                                      ├─ 3. client.beforeSend(event)        最后一次改写/丢弃
                                      └─ 4. transport.send(event)  ──────────►  ConsoleTransport / HttpTransport
```

另有一条**带链路上下文的采集路径**（Sentry 风格）：

```
Monitor.capture(event) → Hub.captureEvent() → Scope.applyToEvent()（注入 context + trace）→ Client.capture()
```

- `Client.capture` 是底层出口，**enrich middleware** 用的是 Client 自己的 `scope`。
- `Hub/Monitor` 路径在进 Client 前就用「当前栈顶 Scope」做了 `applyToEvent`，并注入 `trace`。两条路径都能用，Hub 路径多了 Scope 栈 + trace。

---

## 3. 模块清单与实现状态

图例：✅ 已实现 ｜ 🟡 部分/示例 ｜ ⬜ 空壳（0 行，仅占位）

### `@monitor/event-contract`
- ✅ `BaseEvent` + `createEvent()`、`TraceContext`（`src/event/BaseEvent.ts`）
- ✅ Trace 模型：`Transaction` / `Span`（`src/trace/`）
- ⬜ `ErrorEvent` / `PerformanceEvent` / `BehaviorEvent` / `ReplayEvent`（类型细分，未写）
- ⬜ `session/Session`、`session/SessionManager`、`schema/`、`versioning/`

**BaseEvent 真实结构**：
```ts
interface BaseEvent {
  id: string;
  type: string;            // "error" | "performance" | "custom" ... 不是枚举，是 string
  timestamp: number;
  platform: string;        // "web" | "react" | "vue" | "app"
  context: Record<string, unknown>;  // enrich 阶段从 Scope 合并
  trace?: TraceContext;    // 有 transaction 时由 Hub/Scope 注入
  payload: unknown;        // 结构由 type 决定
}
```

### `@monitor/sdk-core`
- ✅ `Client`（`capture` 主流程、middleware 装配、integration 注册/setup、beforeSend）
- ✅ Pipeline：`MiddlewarePipeline`、`builtins`（4 个内置 middleware + `BUILTIN_PRIORITY`）、`normalize/enrich/filter/sampling`、`contextMiddleware`
- ✅ 上下文：`Scope`（user/tags/route/breadcrumbs/context/transaction + clone）、`Hub`（Scope 栈 + Transaction）、`Monitor`（门面）
- ✅ Integration：`Integration` 接口、`IntegrationRegistry`、`DynamicLoader`（运行时按需开启）、`IntegrationManager`
- ✅ Transport：`Transport` 接口、`ConsoleTransport`、**`HttpTransport`（fetch + keepalive，新增）**
- ✅ `init(options)` 入口
- ⬜ `event/EventDispatcher`、`event/EventFactory`、`event/EventProcessor`（空壳，目前职责已被 Client/Hub/createEvent 覆盖，待定是否还需要）
- ⬜ `config/`、`context/`（空目录占位）

### `@monitor/sdk-web`
- ✅ `initWebSDK()`（默认装 GlobalError + PromiseRejection + Fetch）
- ✅ 错误：`GlobalError`（window.onerror）、`PromiseRejection`
- ✅ 网络：`Fetch`（fetch 插桩）
- ⬜ 网络：`XHR`
- ⬜ 错误：`ResourceError`
- ⬜ 行为：`behavior/Click`、`Exposure`、`Route`
- ⬜ 性能：`performance/FP`、`FCP`、`LCP`、`CLS`、`INP`
- ⬜ 回放：`replay/MutationRecorder`、`Snapshot`
- ⬜ `runtime/`（window/navigator/document/performance 安全访问封装）

### `@monitor/sdk-react` / `@monitor/sdk-vue`
- ⬜ **全部空壳**：index、ErrorBoundary/ReactProfiler/Router/Suspense（react）、ComponentTracing/ErrorHandler/Router（vue）

### 空壳包（已建包但无内容，**不要往里写，也不要 import**）
- ⬜ `@monitor/types`（类型实际在 event-contract）
- ⬜ `@monitor/transport`（transport 实际在 sdk-core）
- ⬜ `@monitor/shared`

---

## 4. 扩展该怎么接（给 GPT 的"正确姿势"）

- **加一个采集能力** → 在对应平台包写一个 `class XxxIntegration implements Integration`，`setup(client)` 里装 runtime hook，调 `client.capture(createEvent(type, payload))`。**不改 core**。
- **加一个处理逻辑** → 写一个 `Middleware`（`{ name, priority?, handle(event, next) }`），用 `client.addMiddleware()` 接入；要丢弃事件就 `return null`，否则 `return next(改写后的 event)`。**优先级数值越大越先执行**，内置占用 70–100。
- **换/加出口** → 实现 `Transport` 接口（`send(event): void | Promise<void>`），通过 `init({ transport })` 注入；网络上报已有 `HttpTransport`。
- **加链路追踪** → 走 `Monitor`/`Hub`：`startTransaction(name, op)` → `tx.startSpan()`，事件经 Hub 路径采集会自动带 `trace`。
- **运行时按需开关能力** → `IntegrationRegistry.register(name, factory)` 登记，`DynamicLoader.enable(name)` 开启。

---

## 5. 工程信息

- 包管理：pnpm workspace；构建编排：turbo（各包 `dist/` 为产物，`.turbo/*.log` 为缓存日志）。
- 测试：**vitest**，测试文件 `*.test.ts` 与源码同目录。当前 sdk-core 35 个用例全绿。
- 类型：每包独立 `tsconfig.json`，`tsc --noEmit` 通过。
- 包导出统一：`main: dist/index.js`、`types: dist/index.d.ts`。

---

## 6. 还没做、需要决策的点（建议 GPT 聚焦这些，而不是重写已有部分）

1. 性能采集（Web Vitals：FP/FCP/LCP/CLS/INP）——目前全空。
2. 行为采集（Click/Exposure/Route）+ 把行为转成 breadcrumb 喂进 Scope。
3. 错误补全：ResourceError、XHR 插桩。
4. 回放（rrweb 思路：MutationRecorder/Snapshot）。
5. React / Vue 适配层（ErrorBoundary、Profiler、Router tracing 等）——目前全空。
6. 事件类型细分（ErrorEvent/PerformanceEvent…）要不要做、`payload` 是否需要按 type 强约束。
7. 出口增强：HttpTransport 的重试 / 批量 / 离线队列 / `sendBeacon` 卸载兜底。
8. Session 管理（Session/SessionManager 空壳）。
9. `event/EventDispatcher|Factory|Processor` 空壳——确认是否并入 Client 后删除，避免误导。
10. 后端 ingest 服务 / 控制台前端（仓库目前只有 SDK 侧）。
