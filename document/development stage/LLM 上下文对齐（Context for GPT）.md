# LLM 上下文对齐（Context for GPT）

> 用途：把本 SDK 的**真实当前状态**一次性喂给 LLM（GPT / Claude 等），让它在不读全仓的情况下给出**不跑偏**的建议。
> 权威性：架构规则以 `document/ARCHITECTURE.md` 为准；本文是它的「现状投影 + 给 LLM 的对齐清单」。
> 核对方式：逐文件读源码（非凭记忆）。最后核对：2026-06-25，对应 commit `bdf5b94`。
> 颗粒度约定：每节 = 一条事实 + 配套硬规则。**不写历史快照、不写未来设想**，只写"现在代码里是什么 + 不许怎么动"。

---

## 0. 心智模型（一句话）

> **一切采集 = 把运行时信号包成统一 `BaseEvent`，经 `Client.capture` 这唯一入口流过固定管道送出。**
> 新增能力 = 加一个 `Integration` 插件；**不碰 Core、不碰契约、不加新层**。

---

## 1. 包分层（依赖严格单向，禁止反向/环）

```
@monitor/event-contract   纯类型契约 + Trace 模型，零运行时依赖，谁都能依赖它
        ▲
@monitor/sdk-core         运行时内核：Client / Hub / Scope / Middleware / Transport / Integration
        ▲
@monitor/sdk-web          浏览器能力插件（error / network / behavior，performance·replay 待填）
@monitor/sdk-react/-vue   框架适配插件（当前全空壳）
```

硬规则：
- 依赖**只能向上**；`sdk-core` 不许 import `sdk-web`，`event-contract` 不许 import 任何包。ESLint 会拦跨层 import。
- `sdk-core` **不认识**任何具体能力（不知道 click/fetch/lcp 是什么），只认识 `BaseEvent` 和 `Integration`。
- ❌ **空壳包不要碰**：`@monitor/types`（类型实际在 event-contract）、`@monitor/transport`（实际在 sdk-core/transport）、`@monitor/shared`。不要往里写、不要从它们 import。

---

## 2. 唯一事件契约 `BaseEvent<T>`

源文件 `packages/event-contract/src/event/BaseEvent.ts`。所有事件无一例外是这个形状：

```ts
interface BaseEvent<T = unknown> {
  id: string;                       // crypto.randomUUID()，normalize 兜底
  type: EventType;                  // 见下
  timestamp: number;                // Date.now()，normalize 兜底
  platform: string;                 // "web" | …，normalize 兜底
  context: Record<string, unknown>; // 由 Hub/Scope 单点注入，采集方不要手填
  trace?: TraceContext;             // 有 transaction 时由 Hub 注入
  payload: T;                       // 唯一放业务数据的地方
}

type EventType = "error" | "performance" | "behavior" | "custom" | (string & {});
```

硬规则：
- **业务数据只放 `payload`**。禁止在事件上加 `data` / `url` / `name` / `sdkVersion` 之类平级字段。
- `context` / `trace` 采集方**一律不填**，由 `Hub.applyToEvent` 单点注入。
- 用工厂 `createEvent(type, payload)` 造、用 `validateEvent(e)` 守门，**不要手写事件字面量**。两者都从 `@monitor/event-contract` 导出。
- `(string & {})` 口子允许细分子类型（Fetch 用 `"http"`），但**优先复用四个一等类型**；行为统一 `"behavior"`，子类型放 `payload.action`（见 `BehaviorEvent.ts`：`BehaviorAction` / `ClickPayload` / `RouteChangePayload` / `ExposurePayload`）。
- ❌ 不存在 `EnrichedEvent` 类型，不存在顶层 `name` 字段。别建议引入。

---

## 3. 唯一采集入口 `Client.capture`（固定 6 步，不可绕过）

源文件 `packages/sdk-core/src/client/Client.ts`，`capture()` 实际顺序：

```
capture(event)
  0. validateEvent           结构非法 → 静默丢弃（不抛错）
  1. integration.beforeSend  插件链同步增强/丢弃（任一返回 null 即整条丢）
  2. hub.applyToEvent        ★唯一 context+trace 注入点（在 middleware 之前）
  3. pipeline.execute        STRUCTURAL → CONTEXTUAL → POLICY（见 §4）
  4. beforeSend              用户最后一次改写/丢弃
  5. transport.send          出口
```

硬规则：
- **只有 `Client` 编排 pipeline 与 transport**。插件 / Hub / middleware 都**不得**自己调 `transport.send`。
- context 注入**只在第 2 步发生一次**；middleware 内**禁止**再做 scope merge（避免双重注入）。
- 任一步判定丢弃 → 静默 `return`，不抛错、不上报。监控 SDK 绝不能把自身故障抛回宿主应用。

---

## 4. 三大内核构件（能力无关）

| 构件 | 源文件 | 职责 | 关键约束 |
|---|---|---|---|
| **Client** | `client/Client.ts` | 事件调度 + 生命周期编排 | 唯一持有 Hub / pipeline / transport；唯一入口 `capture` |
| **Hub + Scope + Transaction** | `hub/Hub.ts`·`hub/Scope.ts` | 运行时上下文容器 | **全局唯一 Hub**（Client 持有，构造时压入根 Scope）；`applyToEvent` 是唯一 context/trace 注入点；Scope 栈 `pushScope/popScope/withScope` 支持 modal/route 嵌套，`clone()` 复制、根 Scope 不被弹出；`Monitor` 复用 `client.getHub()`，不另建 |
| **MiddlewarePipeline** | `middleware/MiddlewarePipeline.ts` | 可插拔事件处理链（Koa 洋葱模型） | 排序 = 阶段序 `STRUCTURAL→CONTEXTUAL→POLICY`，同阶段 priority 降序；注册顺序不影响执行顺序；任一层 `return null` 短路；`next()` 重复调用会抛错；`execute` 仅供 Client 调 |

Middleware 三阶段语义（`MiddlewareType` 枚举；缺省归 CONTEXTUAL）：
- **STRUCTURAL**：补齐/规整结构 —— `normalize`（兜底 id/timestamp/platform/context）。
- **CONTEXTUAL**：注入运行时维度 —— `contextMiddleware`（仅 url/userAgent，`globalThis` 探测，SSR 安全降级；事件自带 context 优先级更高）。
- **POLICY**：决定去留 —— `filter`（结构非法丢弃）/ `sample`（采样率，默认 `sampleRate=1` 全量）。未来限流/去重也归这里。

默认链（Client 构造时装配）：`normalize → context → filter → sample`。内置 priority 占 70–100。

Transport（`transport/`）：`ConsoleTransport`（默认）/ `HttpTransport`（有 dsn；fetch + keepalive + 重试默认共 3 次 + `sendBeacon` 兜底，全程吞异常）。可被 `init({ transport })` 覆盖。

---

## 5. 扩展机制（唯一就是 Integration）

`Integration` 接口（`integration/Integration.ts`）：

```ts
interface Integration {
  name: string;
  setup(client: Client): void;       // 装 runtime hook，必须 SSR 安全降级
  beforeSend?(e): BaseEvent | null;   // 可选：pipeline 前增强/丢弃
  teardown?(): void;                  // 可选：还原 hook（Client.close 调用）
}
```

生命周期由 Core 统一管：`registerIntegration` / `setupIntegrations` / `use`（动态注册并立即 setup）/ `close`（批量 teardown）。另有 `IntegrationManager`（批量装配）、`IntegrationRegistry`（名称→工厂表，按需 `create`）、`DynamicLoader`（运行时开启）。

粒度铁律：**一个能力 = 一个 Integration**（独立文件 / 独立 setup·teardown / 独立单测 / 可单独 tree-shake），一律 `client.capture(createEvent(type, payload))` 出事件。

❌ 禁止的反模式（本节核心）：
- **不要再造"BehaviorLayer / 宿主插件"这种二层插件系统**（integrations 里只挂一个壳，壳内部又维护一套子插件注册表 + 自管 enable/destroy 生命周期）。它和 Core 已有的 Manager/Registry/DynamicLoader 重复造轮子，且自管生命周期最易漏还原副作用。
- 共享诉求的正解：**共享状态**（breadcrumb 缓冲 / session / 共享 observer / 行为采样率）下沉到 Hub/Scope 或普通 util，插件去**调用**；**批量开关**用配置糖（`SDKOptions` 加 `behavior?: boolean | {...}`），不是新增架构层。

Integration vs Middleware 选择：**采新信号 → 写 Integration；对所有/某类事件统一做一件事 → 写 Middleware。**

---

## 6. 落地状态（✅ 已实现 / ⬜ 空壳待填）

| 域 | 状态 |
|---|---|
| event-contract：`BaseEvent` + `createEvent` + `validateEvent`、`TraceContext`、`Transaction`/`Span`、`BehaviorEvent` payload 契约 | ✅ |
| sdk-core：`Client` / `Hub` / `Scope` / `Monitor` / `MiddlewarePipeline` + 4 内置 middleware / `ConsoleTransport` / `HttpTransport` / Integration 注册体系 | ✅ |
| sdk-web error：`GlobalError`(window.onerror) / `PromiseRejection` | ✅ |
| sdk-web network：`Fetch`（fetch 插桩） | ✅ |
| sdk-web behavior：`Click` / `Route` / `Exposure`（+ `dom.ts` 共享纯函数，含单测） | ✅ |
| 全链路 e2e 契约测试 + demo 浏览器触发页 | ✅ |
| sdk-web performance：FP/FCP/LCP/CLS/INP | ⬜ |
| sdk-web network：XHR 插桩 | ⬜ |
| sdk-web error：ResourceError | ⬜ |
| sdk-web replay：MutationRecorder / Snapshot | ⬜ |
| sdk-react / sdk-vue 适配层 | ⬜（全空壳） |
| Session / SessionManager、事件类型细分（ErrorEvent/PerformanceEvent…） | ⬜（待决策） |

> 工程：pnpm workspace + turbo；测试 vitest（`*.test.ts` 同目录）；每包 `tsc --noEmit` 通过。

---

## 7. 给 LLM 的对齐清单（提建议前逐条自检）

- [ ] 我加的是"新信号来源"？→ 写一个 `Integration`，别的都不动。
- [ ] 我想发明新事件字段 / 新顶层 `EventType`？→ 默认**不要**，先用 `payload`；行为子类放 `payload.action`。
- [ ] 我想新增一层"宿主 / 管理器 / Layer"装一组插件？→ **停**（违反 §5），改用配置糖 + 共享 util。
- [ ] 我想让插件直接发 transport / 自己注入 context？→ **不行**，唯一入口 `Client.capture`，唯一注入点 `Hub.applyToEvent`。
- [ ] 我加的是"对所有/某类事件统一处理"？→ 那是 Middleware，归到对应 `MiddlewareType` 阶段，不是 Integration。
- [ ] 我是不是在用过时认知？→ 以下都**不存在/勿引入**：`SDKCorePipeline`、`PipelineStage`、`EnrichedEvent`、顶层 `name` 字段、从 `@monitor/types`/`@monitor/transport` import。
- [ ] 改动动了分层 / 契约 / 管道顺序 / 粒度规则？→ **先改 `ARCHITECTURE.md`，再改代码**。
