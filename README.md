# Front-end Performance Monitoring Platform

前端监控平台 MVP：Web SDK + 事件接入网关 + PostgreSQL 存储。

当前正在落地的 MVP 链路：

```text
demo-web → sdk-web → ingest-gateway → PostgreSQL
```

## 环境要求

- Node.js >= 20
- pnpm 9.15.4
- Docker Desktop（运行本地数据库时需要）

## 常用命令

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 当前实现

- `@monitor/event-contract`：统一事件结构、错误/性能/行为 payload、Trace。
- `@monitor/sdk-core`：Client、Hub/Scope、Middleware、去重、限流、Transport。
- `@monitor/sdk-web`：Web 错误、Fetch/XHR、行为和部分性能采集。
- `@monitor/ingest-gateway`：MVP 批量事件接入、项目 key/origin 校验与 PostgreSQL 幂等写入。

## 暂未纳入 MVP

Session Replay、React/Vue 适配、Kafka、ClickHouse、告警、SourceMap、RBAC 和生产级 K8s 部署。

详细推进设计见 `docs/mvp/`。
