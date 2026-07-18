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

# 停止服务，保留 PostgreSQL 数据卷
pnpm mvp:down
```

## 当前实现

- `@monitor/event-contract`：统一事件结构、错误/性能/行为 payload 与 Trace。
- `@monitor/sdk-core`：Client、中间件、隐私治理、采样、去重、限流和批量传输。
- `@monitor/sdk-web`：Web 错误、网络、行为和 Web Vitals 采集。
- `@monitor/ingest-gateway`：批量接入、SDK Key/Origin 校验和幂等写入。
- `@monitor/processor-worker`：错误指纹、错误分组、性能分钟聚合和失败重试。
- `@monitor/query-service`：项目级管理鉴权、总览、性能、错误、事件和版本查询。

Session Replay、告警、Source Map、完整 RBAC、Kafka、ClickHouse 和生产级 K8s 部署尚未纳入当前 MVP。

详细架构、接口和本地运行说明见 [`docs/mvp`](./docs/mvp)。
