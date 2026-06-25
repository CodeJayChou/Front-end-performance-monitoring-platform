# SDK 架构契约（Source of Truth）

> 本文是 SDK 端架构的**唯一权威描述**。任何设计建议（含 AI 生成）若与本文冲突，以本文为准；
> 要改架构，先改本文，再改代码。目的：锁定**粒度**与**边界**，防止"每加一个能力就发明一层抽象"导致失控。

---

## 0. 一句话心智模型

> **一切采集 = 把运行时信号包装成统一 `BaseEvent`，经 `Client.capture` 这唯一入口流过固定管道送出。**
> 新增能力 = 新增一个 `Integration` 插件，**不碰** Core、不碰契约、不加新层。

---

## 1. 分层与依赖方向（严格单向，禁止反向/环）

```
@monitor/event-contract   ← 纯类型契约，零运行时依赖，谁都能依赖它
        ▲
@monitor/sdk-core         ← 运行时内核：Client / Hub / Middleware / Transport / Integration 接口
        ▲
@monitor/sdk-web          ← 浏览器能力插件（error / network / behavior / performance / replay …）
@monitor/sdk-react /-vue  ← 框架适配插件，依赖 sdk-core（+ 复用 sdk-web）
```

规则：
- **依赖只能向上**。`sdk-core` 不许 import `sdk-web`；`event-contract` 不许 import 任何包。
- `sdk-core` **不认识**任何具体能力（不知道什么是 click / fetch / lcp），只认识 `BaseEvent` 和 `Integration`。
- 后端 `apps/*`（ingest-gateway / processor-worker …）消费 `BaseEvent`，**复用同一份 `event-contract`**，不得另立事件格式。

---

## 2. 唯一事件契约 `BaseEvent<T>`

所有事件——无一例外——是这个形状（`packages/event-contract/src/event/BaseEvent.ts`）：

```ts
interface BaseEvent<T = unknown> {
  id: string;                      // crypto.randomUUID()
  type: EventType;                 // 见下
  timestamp: number;               // Date.now()
  platform: string;                // "web" | …，normalize 阶段兜底
  context: Record<string, unknown>;// 由 Hub/Scope 注入，采集方不要手填
  trace?: TraceContext;            // 有 transaction 时由 Hub 注入
  payload: T;                      // 唯一放业务数据的地方
}

type EventType = "error" | "performance" | "behavior" | "custom" | (string & {});
```

硬规则：
- **业务数据只放 `payload`**。不要在事件上加 `data` / `url` / `sdkVersion` 之类的平级字段（这是旧 `Behavior.md` 的错误形态）。
- `context` / `trace` **采集方一律不填**，由 `Hub.applyToEvent` 单点注入。URL、user、tags、breadcrumbs 都走 context，不进 payload（行为类需要落点 URL 时例外，可放 payload）。
- 用 `createEvent(type, payload)` 工厂创建，用 `validateEvent` 守门。**不要手写事件字面量**。
- `EventType` 的 `(string & {})` 口子允许细分子类型（如 Fetch 用 `"http"`），但**优先复用四个一等类型**；行为统一用 `"behavior"`，子类型放 `payload.action`。

---

## 3. 唯一采集入口：`Client.capture`（固定 6 步管道）

`packages/sdk-core/src/client/Client.ts`。**这是平台唯一真入口**，顺序固定、不可绕过：

```
capture(event)
  0. validateEvent          结构不合法 → 静默丢弃
  1. integration.beforeSend  插件链同步增强/丢弃（任一 null 即丢）
  2. hub.applyToEvent        ★唯一 context+trace 注入点（在 middleware 之前）
  3. middleware.pipeline     STRUCTURAL → CONTEXTUAL → POLICY（见 §4）
  4. beforeSend              用户最后一次改写/丢弃
  5. transport.send          出口
```

铁律：
- **只有 `Client` 编排 pipeline 和 transport**。插件/Hub/中间件都**不得**自己调 `transport.send`。
- context 注入**只在第 2 步发生一次**。middleware 内不准再做 scope merge（避免双重注入）。
- 任一步判定丢弃 → 静默 return，不抛错、不上报。

---

## 4. 三大内核构件（sdk-core，能力无关）

| 构件 | 职责 | 关键约束 |
|---|---|---|
| **Client** | 事件调度 + 生命周期编排 | 唯一持有 Hub / pipeline / transport；唯一入口 `capture` |
| **Hub + Scope + Transaction** | 运行时上下文容器 | **唯一一个 Hub**（`Client` 持有）；`applyToEvent` 是唯一 context/trace 注入点；Scope 栈支持 modal/route 嵌套；Monitor 等**复用** `client.getHub()`，不另建 |
| **MiddlewarePipeline** | 可插拔事件处理链（洋葱模型） | 三阶段序 `STRUCTURAL→CONTEXTUAL→POLICY`，同阶段按 priority 降序；注册顺序不影响执行顺序；`execute` 仅供 Client 调 |
| **Transport** | 出口 | `ConsoleTransport`（默认）/ `HttpTransport`（有 dsn）；可被 options 覆盖 |

Middleware 三阶段语义：
- **STRUCTURAL**：补齐/规整结构（`normalize` 兜底 timestamp/platform/context）。
- **CONTEXTUAL**：注入运行时维度（`contextMiddleware`）。
- **POLICY**：决定去留（`filter` / `sample` / 未来的限流、去重）。

---

## 5. 插件粒度规则 ★（防失控的核心，务必对齐）

### 5.1 唯一的扩展机制就是 `Integration`

`sdk-core` **已经是插件系统**。`Integration` 接口（`integration/Integration.ts`）：

```ts
interface Integration {
  name: string;
  setup(client: Client): void;        // 安装 runtime hooks，必须 SSR 安全降级
  beforeSend?(e): BaseEvent | null;    // 可选：pipeline 前增强/丢弃
  teardown?(): void;                   // 可选：还原 hooks（Client.close 调用）
}
```

注册与生命周期由 Core 统一管：`registerIntegration` / `setupIntegrations` / `use`（动态）/ `close`（批量 teardown）。还有 `IntegrationManager` / `registry` / `DynamicLoader` 管去重与按需加载。

### 5.2 粒度定义：**一个能力 = 一个 Integration**

- ✅ `ClickIntegration` / `RouteIntegration` / `ExposureIntegration` / `FetchIntegration` / `LCPIntegration` …
- 每个插件：独立文件、独立 `setup/teardown`、独立单测、可独立 tree-shake。
- 一律 `client.capture(createEvent(type, payload))` 出事件。

### 5.3 ❌ 禁止的反模式（这是本文要拦住的"失控"）

> **不要再造"Behavior Layer / 宿主插件"这种二层插件系统。**

即：**禁止**让 integrations 里只挂一个 `BehaviorLayer`，再由它内部维护一套自己的子插件注册表 + 自己的 `enableClick/destroy` 生命周期。理由：
1. 与 Core 已有的 `IntegrationManager`/`registry`/`DynamicLoader` 重复造轮子；
2. 自管生命周期最易漏（旧 `Behavior.md` 的 `destroy()` 就漏还原 history patch）；
3. 破坏"加/减一行 integration 即开关一个能力"的统一装配。

### 5.4 那"行为类共享状态/批量开关"怎么办？（合理诉求的正解）

- **共享状态**（breadcrumb 缓冲 / session / 共享 observer / 行为采样率）下沉到 **Hub/Scope** 或普通共享 util，插件去**调用**它——不是新开一层宿主。
- **批量开关**用**配置糖**，不是架构层：在 `initWebSDK` 给 `SDKOptions` 加 `behavior?: boolean | { click?; route?; exposure? }`，据此决定 push 哪些插件即可。

---

## 6. Integration vs Middleware：何时用哪个

| 维度 | Integration | Middleware |
|---|---|---|
| 角色 | **事件的来源**（采集 runtime 信号） | **事件的处理**（对已存在的事件做加工/决策） |
| 典型 | click、fetch、lcp、onerror | normalize、context 注入、filter、sample、限流、脱敏 |
| 数量关系 | 一能力一个 | 全局共享一条链 |
| 加它的判据 | "我要采一种新信号" | "我要对**所有/某类**事件统一做一件事" |

口诀：**采新信号 → 写 Integration；改所有事件 → 写 Middleware。**

---

## 7. 文件 / 命名约定

```
packages/event-contract/src/event/<Domain>Event.ts   // payload 契约，如 BehaviorEvent.ts
packages/sdk-web/src/integrations/<domain>/<Cap>.ts    // 能力插件，如 behavior/Click.ts
packages/sdk-web/src/integrations/<domain>/<util>.ts   // 域内共享纯函数，如 behavior/dom.ts
packages/sdk-web/src/integrations/<domain>/<Cap>.test.ts
```

- 类名 `XxxIntegration`，`name` 字段与能力同名（`"Click"`）。
- 新插件必须：① SSR 安全降级（`typeof window === "undefined"` 早退）；② 实现 `teardown` 还原副作用；③ 配单测（仓库用手动 stub window，不引 jsdom）。
- 装到 `initWebSDK` 默认列表 + 从 `index.ts` 导出。

---

## 8. 现状落地清单

**已实现**：`GlobalError` / `PromiseRejection`（error），`Fetch`（network），`Click` / `Route` / `Exposure`（behavior）。事件契约 `BaseEvent` + `BehaviorEvent` payload 已定。全链路 e2e 测试已通。

**空壳待填**（按本文契约填，勿改架构）：performance（FP/FCP/LCP/CLS/INP）、network/XHR、replay（MutationRecorder/Snapshot）、error/ResourceError，以及 sdk-react / sdk-vue 适配插件。

---

## 9. 给协作者（含 AI）的对齐清单 —— 提建议前先过一遍

- [ ] 我要加的是"新信号来源"吗？→ 写一个 `Integration`，别的都不动。
- [ ] 我有没有想发明新的事件字段 / 新的 `EventType` 顶层类型？→ 默认**不要**，先用 `payload`。
- [ ] 我有没有想新增一层"宿主/管理器/Layer"来装一组插件？→ **停**，违反 §5.3，改用配置糖（§5.4）。
- [ ] 我有没有想让插件直接发 transport / 自己注入 context？→ **不行**，唯一入口是 `Client.capture`，唯一注入点是 `Hub.applyToEvent`。
- [ ] 我加的东西是"对所有事件统一处理"吗？→ 那是 Middleware，不是 Integration。
- [ ] 改动是否需要先更新本文？→ 若动了分层/契约/管道顺序/粒度规则，**先改本文**。
