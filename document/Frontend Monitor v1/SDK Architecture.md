SDK 的本质职责（先定边界）

前端监控 SDK 只做三件事：

采集（Collect）：捕获事件（error / performance / behavior / replay hook）
标准化（Normalize）：转成统一 Event Model
上报（Transport）：可靠送达服务端

重点：SDK 不做业务分析、不做聚合，只做“数据生产端”

2. SDK 总体架构（分层模型）

可以抽象为 5 层：

┌────────────────────────────┐
│  Application Layer         │  用户业务代码
├────────────────────────────┤
│  Instrumentation Layer     │  自动埋点（error/perf/dom）
├────────────────────────────┤
│  Plugin Layer              │  可插拔能力扩展
├────────────────────────────┤
│  Core Processing Layer     │  Event Pipeline（核心）
├────────────────────────────┤
│  Transport Layer           │  上报 / 重试 / 缓存
└────────────────────────────┘
3. 核心设计：Event Pipeline（关键）

所有数据进入统一流水线：

Raw Event
   ↓
Capture
   ↓
Transform（标准化 Event Schema）
   ↓
Enrich（上下文补全）
   ↓
Filter（采样 / 黑名单）
   ↓
Batch
   ↓
Send
4. SDK Core 结构拆解
4.1 Core Manager（SDK 入口）
class MonitorSDK {
  init(config)
  use(plugin)
  capture(event)
}

职责：

初始化配置
注册插件
控制生命周期
提供统一 capture API
4.2 Event Model（统一数据结构）

你后面所有体系都依赖它（非常关键）

interface BaseEvent {
  id: string
  type: 'error' | 'performance' | 'replay' | 'custom'
  timestamp: number
  sdkVersion: string
  env: {
    url: string
    userAgent: string
    appVersion?: string
  }
  context: Record<string, any>
}

👉 这一层是你整个监控体系的“语义地基”

4.3 Instrumentation Layer（采集层）

负责“自动监听”

子模块：
ErrorCollector
PerfCollector
Fetch/XHR Interceptor
DOM Interaction Tracker

示例：

window.addEventListener('error', handler)
window.addEventListener('unhandledrejection', handler)

👉 这一层是“数据入口”

4.4 Plugin System（扩展核心）

这是你后面做“可演化系统”的关键

interface Plugin {
  name: string
  setup(core)
  transform?(event)
}
插件类型：
samplingPlugin（采样）
filterPlugin（过滤）
enrichPlugin（补充用户信息）
replayPlugin（录制接入）
customMetricsPlugin

👉 SDK 的能力边界完全由插件决定

4.5 Processing Layer（事件处理中心）

核心结构：

class EventPipeline {
  use(plugin)
  execute(event)
}

处理流程：

串行 middleware
可中断（return null）
可修改 event

类似：

event → middleware1 → middleware2 → middleware3 → send
4.6 Transport Layer（上报层）

负责“可靠性”

关键能力：

1. batch 合并
queue.push(event)
flush every 5s or size > N
2. retry
exponential backoff
failure queue
3. beacon 上报
navigator.sendBeacon
fallback fetch
4. offline cache
localStorage / IndexedDB
5. SDK 数据流（完整链路）
Browser Event
   ↓
Collector
   ↓
BaseEvent Transform
   ↓
Plugin Pipeline
   ↓
Batch Queue
   ↓
Transport Sender
   ↓
Ingest Gateway
6. SDK 关键工程能力（决定生产质量）
6.1 防污染机制
try/catch 全覆盖
plugin isolate（插件失败不影响主链路）
6.2 采样系统（必须有）
if (Math.random() > rate) return

支持：

全局采样
类型采样（error 100%，performance 10%）
6.3 上下文注入（非常关键）

所有事件自动带：

sessionId
traceId
userId（如果有）
6.4 SDK Versioning（你之前提过）
sdkVersion: major.minor.patch
eventSchemaVersion: v1 / v2 / v3
7. SDK 演化路线（重点）
Stage 1：MVP SDK
error + performance
简单 batch 上报
Stage 2：可扩展 SDK
plugin system
event pipeline
context enrich
Stage 3：企业级 SDK
replay 接入
多端（web / h5 / miniapp）
schema versioning
灰度采样系统
Stage 4：平台化 SDK
动态配置下发
feature flag
remote config SDK behavior
8. 和你项目的关系（很重要）

你现在的体系：

Event Model / Domain Model / Replay / 可观测体系

SDK 是：

👉 数据源头层（Source of Truth）

如果 SDK 设计不稳定：

后端怎么建都没用
数据会永久污染
9. 一句话总结架构本质

这个 SDK 本质是：

“一个可插拔的事件处理管道 + 可靠上报系统 + 可演化的数据协议层”