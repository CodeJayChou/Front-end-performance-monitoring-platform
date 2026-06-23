Dashboard Architecture（控制台架构）

而是一个面向多数据源 + 多维分析 + 实时/离线混合消费的查询与可视化系统。

2. 整体架构分层（核心模型）
[ UI Layer ]
   ↓
[ Dashboard Application Layer ]
   ↓
[ Query Orchestration Layer ]
   ↓
[ Analytics API Layer ]
   ↓
[ Storage Layer ]

3. UI Layer（展示层）

这一层是“无脑层”，只负责 render：

模块组成
Chart Engine（ECharts / Visx）
Table Engine
Filter Panel（时间 / app / user / version）
Drilldown UI
Replay Viewer（如果接 replay）
核心原则
不直接请求数据库
不写业务聚合逻辑
只消费统一 query result schema

4. Dashboard Application Layer（应用编排层）

这是最关键的一层（很多系统失败点在这里）。

职责：
4.1 页面状态管理
dashboard layout state
widget state
filter state（global + local）
4.2 Query Builder

把 UI 操作转换成：

{
  "metric": "error_rate",
  "filters": {
    "app": "web",
    "version": "1.2.0"
  },
  "groupBy": ["route"],
  "timeRange": "last_24h"
}
4.3 Widget Orchestration

一个 dashboard = 多 widget：

Error Rate Chart
P95 Latency
JS Error Top List
Session Replay Links

👉 每个 widget = 独立 query unit

5. Query Orchestration Layer（核心复杂度所在）

这一层决定系统上限。

功能：
5.1 Query Router
metrics → TSDB（Prometheus / ClickHouse）
logs → Log DB
trace → Trace DB
session → Replay storage
5.2 Query Federation（重点）

一个 dashboard query 可能跨多个源：

error_rate + session replay + logs

需要：

fan-out query
result merge
normalization
5.3 Caching Layer
query cache（key = hash(query)）
dashboard snapshot cache
time-series pre-aggregation

6. Analytics API Layer

这一层负责“数据计算能力”。

常见能力：
6.1 Aggregation API
groupBy
sum / avg / p95 / p99
time bucket (1m / 5m / 1h)
6.2 Funnel API

用于 user behavior analysis

6.3 Breakdown API

例如：

error_rate by browser
latency by route
6.4 Anomaly API（可选高级）
baseline detection
spike detection

7. Dashboard 数据模型（关键抽象）

建议统一成：

Widget Schema
type Widget = {
  id: string
  type: "line" | "bar" | "table" | "replay"
  query: QuerySpec
  visualization: VisualizationSpec
}
QuerySpec
type QuerySpec = {
  metric: string
  filters: Record<string, any>
  groupBy?: string[]
  aggregation?: string
  timeRange: string
}

8. 关键设计原则（避免系统失控）
8.1 UI 与 Query 解耦

UI 不知道数据源，只知道 QuerySpec

8.2 Widget = 最小分析单元

不要“页面级 SQL”，要“组件级 query”

8.3 查询必须可序列化
可缓存
可回放
可分享（dashboard link）
8.4 数据统一协议（非常关键）

所有 backend 返回：

{
  "timestamps": [],
  "values": [],
  "meta": {}
}

避免多格式污染前端

9. 在你的前端监控系统中的位置

Dashboard 是：

Event Model → Ingest → Storage → Analytics → Dashboard

它的本质是：

“对事件系统的二次消费层（Consumer of Aggregated Events）”

10. 演化路线（建议你重点关注）
Phase 1：简单 Dashboard
固定 SQL / API
手写 chart
Phase 2：Widget 化
query spec 化
dashboard JSON 化
Phase 3：Query Orchestration
多数据源融合
cache + federation
Phase 4：Realtime Dashboard
streaming update
websocket push
Phase 5：Self-service Analytics
用户可自定义 metric
类似 Datadog / Grafana