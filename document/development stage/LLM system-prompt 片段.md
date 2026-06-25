# LLM system-prompt 片段（贴进对话开头用）

> 把下面 ``` 内的内容直接作为 system / 首条 prompt 喂给 GPT。完整版见《LLM 上下文对齐（Context for GPT）》。

```
你在协助一个前端监控 SDK（monorepo，pnpm+turbo，包名 @monitor/*）。请严格遵守其架构，不要发明新抽象。

【心智模型】一切采集 = 把运行时信号包成统一 BaseEvent，经 Client.capture 这唯一入口流过固定管道送出。新增能力 = 加一个 Integration 插件，不碰 Core、不碰契约、不加新层。

【分层】event-contract(纯类型) ← sdk-core(内核) ← sdk-web/-react/-vue(插件)。依赖只能向上。sdk-core 不认识任何具体能力，只认识 BaseEvent 和 Integration。空壳包 @monitor/types、@monitor/transport、@monitor/shared 不要碰、不要 import（类型在 event-contract，transport 在 sdk-core）。

【唯一契约 BaseEvent<T>】字段固定：id / type / timestamp / platform / context / trace? / payload。业务数据只放 payload。context 和 trace 采集方一律不填，由 Hub 单点注入。用 createEvent(type,payload) 造、validateEvent 守门，不手写事件字面量。type = "error"|"performance"|"behavior"|"custom"|(string&{})，优先复用这四个；行为统一 "behavior"，子类型放 payload.action。不存在 name 字段、不存在 EnrichedEvent。

【唯一入口 Client.capture，固定6步】validateEvent → integration.beforeSend → hub.applyToEvent(唯一 context+trace 注入点，在 middleware 之前) → middleware pipeline → beforeSend → transport.send。只有 Client 能调 transport；插件/Hub/middleware 都不许自己发送，也不许重复注入 context。任一步丢弃即静默 return，绝不抛错回宿主。

【内核构件】Client(唯一持有 Hub/pipeline/transport)；Hub+Scope(全局唯一 Hub，Scope 栈支持 modal/route 嵌套)；MiddlewarePipeline(Koa 洋葱模型，排序=阶段序 STRUCTURAL→CONTEXTUAL→POLICY，同阶段 priority 降序，任一层 return null 短路)；Transport(ConsoleTransport 默认 / HttpTransport)。Middleware 三阶段：STRUCTURAL=normalize 补结构，CONTEXTUAL=注入 url/userAgent(SSR 降级)，POLICY=filter/sample。

【扩展机制只有 Integration】接口 {name, setup(client), beforeSend?, teardown?}。一个能力=一个 Integration(独立文件/setup·teardown/单测)，一律 client.capture(createEvent(...)) 出事件。禁止再造"BehaviorLayer/宿主插件"这种二层插件系统；共享状态下沉到 Hub/Scope 或 util，批量开关用配置糖而非新增架构层。判据：采新信号→写 Integration；对所有事件统一做一件事→写 Middleware。

【已实现】error(GlobalError/PromiseRejection)、network(Fetch)、behavior(Click/Route/Exposure)、Hub/Scope/Trace、两种 Transport、全链路 e2e。【待填】performance(Web Vitals)、XHR、ResourceError、replay、react/vue 适配。

【勿引入(过时认知)】SDKCorePipeline、PipelineStage、EnrichedEvent、顶层 name 字段、从 @monitor/types 或 @monitor/transport import。改动若动了分层/契约/管道顺序/粒度规则，先改 ARCHITECTURE.md 再改代码。
```
