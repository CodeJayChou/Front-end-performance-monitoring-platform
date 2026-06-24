# Deprecated / 冻结清单（架构去冗余重构产物）

> 本文件登记**已废弃、禁止新增引用**的抽象与包。仅允许"内部迁移"期间临时存在；
> 新代码一律走"收敛后"的等价物。ESLint 已对其中可静态约束的部分加了护栏。
>
> 重构依据：`架构去冗余重构.md`。最后更新：2026-06-25。

## 已删除（不再存在，禁止重新引入）

| 废弃项 | 替代物 | 备注 |
|---|---|---|
| `SDKCorePipeline`（线性管道） | `MiddlewarePipeline`（洋葱模型） | 设计稿概念，代码中从未落地 |
| `PipelineStage` | `Middleware`（`{ name, type?, priority?, handle(event, next) }`） | 同上 |
| `EventDispatcher` | `Client.capture()` 编排 | 空壳文件，已删除 |
| `EventProcessor` | middleware pipeline | 空壳文件，已删除 |
| `EventFactory` | `createEvent()`（@monitor/event-contract） | 空壳文件，已删除 |
| `packages/types`（`@monitor/types`） | `@monitor/event-contract` | 空壳包，已删除；ESLint `no-restricted-imports` 拦截 |
| `packages/transport`（`@monitor/transport`） | `@monitor/sdk-core/transport` | 空壳包，已删除；ESLint 拦截 |
| `enrich(event, scope)` / `createEnrichMiddleware` | `Scope.applyToEvent()`（在 Client.capture 内，pipeline 之前） | scope merge 移出 middleware |

## 架构硬约束（ESLint enforce）

- **唯一入口**：只有 `Client.capture()` 能触发事件流。
- **分层不穿透**：
  - `transport/**` 不得 import `middleware/**`。
  - `middleware/**` 不得 import `transport/**`。
  - `integration(s)/**` 不得 import `transport/**`；采集只能 `client.capture()`。
- **scope merge 只发生在 pipeline 之前**：middleware 内禁止再做 Scope 合并。

## 收敛后的标准执行链

```
Client.capture(event)
  → validateEvent                         结构门槛
  → integration.beforeSend                插件增强/丢弃
  → Scope.applyToEvent                    注入 context + trace（pipeline 之前）
  → MiddlewarePipeline.execute            STRUCTURAL → CONTEXTUAL → POLICY
      normalize → context → filter → sample → 自定义
  → beforeSend                            最终拦截
  → transport.send                        Console / Http / 自定义
```
