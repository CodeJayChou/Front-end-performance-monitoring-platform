# Front-end Performance Monitoring Platform

前端监控平台 MVP，当前已经具备从 Web SDK 到数据查询的完整主链路：

```text
demo-web → sdk-web → ingest-gateway → PostgreSQL
                                      ↓
                               processor-worker
                                      ↓
                                 query-service
```

## 环境要求

- Node.js >= 20
- pnpm 9.15.4
- Docker Desktop（运行完整本地链路时需要）

## 常用命令

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# 启动全部 MVP 服务
pnpm mvp:up

# 启动浏览器 Demo（http://localhost:5173）
pnpm demo:browser

# 停止服务，保留 PostgreSQL 数据卷
pnpm mvp:down
```

浏览器 Demo 的 **Alert Lab** 可确定性上报 5 条错误、5 条 LCP 5000ms
或 5 条 INP 650ms 样本。先在 Dashboard 告警中心创建对应的 1 分钟规则，
再触发样本并等待完整分钟结束及 Alert Worker 的下一次轮询。

## 当前实现

- `@monitor/event-contract`：统一事件结构、错误/性能/行为 payload 与 Trace。
- `@monitor/sdk-core`：Client、中间件、隐私治理、采样、去重、限流和批量传输。
- `@monitor/sdk-web`：Web 错误、网络、行为和 Web Vitals 采集。
- `@monitor/ingest-gateway`：批量接入、SDK Key/Origin 校验和幂等写入。
- `@monitor/processor-worker`：错误指纹、错误分组、性能分钟聚合和失败重试。
- `@monitor/alert-worker`：完整窗口阈值评估、连续触发、冷却、自动恢复和 Webhook 重试。
- `@monitor/query-service`：项目级管理鉴权、P75/分钟趋势、场景、错误、事件和版本查询。
- `@monitor/dashboard`：P75 核心指标、场景筛选、处理积压、告警规则与告警事件展示。

批量出口在可重试失败后会保留批次，页面隐藏时主动刷新；历史数据可通过
`RETENTION_DAYS=30 pnpm mvp:cleanup` 按保留期事务清理。

Session Replay、Source Map、完整 RBAC、Kafka、ClickHouse 和生产级 K8s 部署尚未纳入当前 MVP。

详细架构、接口和本地运行说明见 [`docs/mvp`](./docs/mvp)。
