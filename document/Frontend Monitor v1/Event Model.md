事件模型 
标准化数据结构规范：

为什么必须要 Event Model（核心原因）
多类型监控数据的“结构统一 + 流程统一 + 可扩展性问题”


Event Model 在架构中的位置
[SDK采集层]
    ↓
Event Model（统一结构层）
    ↓
Ingest Gateway（接入层）
    ↓
Kafka / Queue
    ↓
Consumer（处理层）
    ↓
Storage（ClickHouse / ES / OLAP）

系统边界协议（System Contract）
跨端统一表达（Web / H5 / App）
后端所有计算的输入标准

一个成熟 Event Model 不是“一个 interface”，而是三层结构：
1. Envelope（信封层）
2. Context（上下文层）
3. Payload（业务数据层）


3.1 Envelope（必须稳定，不允许乱改）
interface EventEnvelope {
  eventId: string            // 全局唯一
  type: string               // event 类型（error / perf / behavior）
  timestamp: number          // 发生时间

  sdkVersion: string
  appId: string

  env: {
    platform: "web" | "h5" | "app"
    release?: string
  }
}

3.2 Context（运行时上下文）
interface EventContext {
  user?: {
    userId?: string
    sessionId: string
  }

  page: {
    url: string
    path?: string
    referrer?: string
  }

  device?: {
    ua: string
    os?: string
    browser?: string
    screen?: string
  }
}

3.3 Payload（真正变化的部分）

interface ErrorPayload {
  message: string
  stack?: string
  name: string
  source: "js" | "promise" | "resource"
}

Performance Event
interface PerformancePayload {
  fcp?: number
  lcp?: number
  fid?: number
  ttfb?: number
}

Behavior Event
interface BehaviorPayload {
  action: string
  target?: string
  props?: Record<string, any>
}

4. 最终 Event Model（合体形态）

type Event =
  EventEnvelope & {
    context: EventContext
    payload: any
  }

考虑 Versioning 设计 

原则 1：Event 永远携带版本号
schemaVersion: string

原则 2：Schema 是“向后兼容优先”，不是强升级
不允许 breaking change 直接删除字段
只能扩展 / 映射 / 转换

原则 3：所有变化必须可“转换（migration）”

3. 工业级 Event Model（加入版本体系）
export type EventType =
  | "error"
  | "performance"
  | "behavior"
  | "replay"

3.1 Envelope（加入 schemaVersion）
export interface EventEnvelope {
  eventId: string
  type: EventType
  timestamp: number

  sdkVersion: string

  // ⭐ 核心：schema版本
  schemaVersion: string

  appId: string

  env: {
    platform: "web" | "h5" | "app"
    release?: string
  }
}

3.2 Context（保持稳定层）
export interface EventContext {
  user?: {
    userId?: string
    sessionId: string
  }

  page: {
    url: string
    path?: string
    referrer?: string
  }

  device?: {
    ua: string
    os?: string
    browser?: string
    screen?: string
  }
}

4. Schema 定义层（关键新增）
export interface SchemaDefinition<T> {
  version: string
  validate: (event: any) => boolean
  migrate?: (event: any) => T
}

5. Payload Schema（v1）
export interface ErrorPayloadV1 {
  message: string
  name: string
  stack?: string
  source: "js" | "promise" | "resource"
}

6. Payload Schema（v2：演进示例）
export interface ErrorPayloadV2 {
  message: string
  name: string

  // v2 新增结构化错误码
  code?: string

  stack?: string

  source: "js" | "promise" | "resource"

  // v2 新增：是否可恢复
  recoverable?: boolean
}

7. Schema Registry（核心组件）
export class SchemaRegistry {
  private schemas: Map<string, SchemaDefinition<any>> = new Map()

  register<T>(schema: SchemaDefinition<T>) {
    this.schemas.set(schema.version, schema)
  }

  resolve(version: string) {
    return this.schemas.get(version)
  }

  migrate(event: any) {
    const schema = this.resolve(event.schemaVersion)

    if (!schema) {
      throw new Error("Unknown schema version")
    }

    if (schema.migrate) {
      return schema.migrate(event)
    }

    return event
  }
}

8. Event Model（最终融合版）
export type Event =
  EventEnvelope & {
    context: EventContext
    payload: any
  }

9. SDK 侧如何使用 Schema Versioning
class MonitorSDK {
  private schemaVersion = "1.0.0"

  constructor(private appId: string) {}

  private createBase(): EventEnvelope {
    return {
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "behavior",
      sdkVersion: "1.0.0",
      schemaVersion: this.schemaVersion, // ⭐关键
      appId: this.appId,
      env: {
        platform: "web",
      },
    }
  }
}

10. 上报事件（带版本）
captureError(payload: ErrorPayloadV1) {
  const event: Event = {
    ...this.createBase(),
    type: "error",
    context: this.getContext(),
    payload,
  }

  this.send(event)
}

11. 后端消费（版本兼容关键点）
function handleEvent(event: any, registry: SchemaRegistry) {
  const normalized = registry.migrate(event)

  switch (normalized.type) {
    case "error":
      processError(normalized)
      break
  }
}