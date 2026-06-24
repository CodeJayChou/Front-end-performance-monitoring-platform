核心主干 + pipeline + context + transport + integration

1. Event Contract（统一事件结构）
packages/event-contract/src/index.ts
export interface BaseEvent {
  id: string
  type: string
  timestamp: number
  platform: string
  context: Record<string, any>
  payload: any
}

export function createEvent(type: string, payload: any, platform = "web"): BaseEvent {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    platform,
    context: {},
    payload
  }
}
2. Context（类似 Sentry Scope）
packages/sdk-core/context/Scope.ts
export class Scope {
  private context: Record<string, any> = {}

  setUser(user: any) {
    this.context.user = user
  }

  setTag(key: string, value: string) {
    this.context.tags = this.context.tags || {}
    this.context.tags[key] = value
  }

  setRoute(route: string) {
    this.context.route = route
  }

  addBreadcrumb(message: string) {
    this.context.breadcrumbs = this.context.breadcrumbs || []
    this.context.breadcrumbs.push({
      message,
      timestamp: Date.now()
    })
  }

  getContext() {
    return this.context
  }
}
3. Pipeline（核心处理链）
packages/sdk-core/pipeline/normalize.ts
export function normalize(event: any) {
  return {
    ...event,
    normalized: true
  }
}
enrich.ts
export function enrich(event: any, scope: any) {
  return {
    ...event,
    context: {
      ...scope.getContext()
    }
  }
}
filter.ts
export function filter(event: any) {
  // 示例：过滤空事件
  if (!event || !event.type) return null
  return event
}
sampling.ts
export function sample(event: any) {
  const rate = 1 // 100% 先跑通
  if (Math.random() > rate) return null
  return event
}
4. Transport（输出层）
packages/sdk-core/transport/ConsoleTransport.ts
export class ConsoleTransport {
  send(event: any) {
    console.log("[EVENT SEND]", JSON.stringify(event, null, 2))
  }
}
5. Integration（插件系统）
packages/sdk-core/integration/Integration.ts
export interface Integration {
  name: string
  setup(client: any): void
}
6. Client（核心控制器）
packages/sdk-core/client/Client.ts
import { Scope } from "../context/Scope"
import { ConsoleTransport } from "../transport/ConsoleTransport"
import { normalize } from "../pipeline/normalize"
import { enrich } from "../pipeline/enrich"
import { filter } from "../pipeline/filter"
import { sample } from "../pipeline/sampling"

export class Client {
  scope: Scope
  transport: ConsoleTransport
  integrations: any[] = []

  constructor() {
    this.scope = new Scope()
    this.transport = new ConsoleTransport()
  }

  registerIntegration(integration: any) {
    this.integrations.push(integration)
  }

  setupIntegrations() {
    this.integrations.forEach(i => i.setup(this))
  }

  capture(event: any) {
    // 1. pipeline
    let e = normalize(event)
    e = enrich(e, this.scope)
    e = filter(e)
    if (!e) return
    e = sample(e)
    if (!e) return

    // 2. send
    this.transport.send(e)
  }
}
7. Integration 示例（Web Error）
packages/sdk-web/integrations/error/GlobalError.ts
import { createEvent } from "@event-contract"

export class GlobalErrorIntegration {
  name = "GlobalError"

  setup(client: any) {
    window.onerror = (msg, src, line, col, err) => {
      client.capture(
        createEvent("error", {
          message: msg,
          stack: err?.stack,
          src,
          line,
          col
        })
      )
    }
  }
}
8. SDK 初始化入口（最关键）
packages/sdk-core/init.ts
import { Client } from "./client/Client"

export interface SDKOptions {
  integrations?: any[]
}

export function init(options: SDKOptions = {}) {
  const client = new Client()

  // 注册插件
  options.integrations?.forEach(i => {
    client.registerIntegration(i)
  })

  // 启动插件
  client.setupIntegrations()

  return client
}
9. Web SDK 入口
packages/sdk-web/index.ts
import { init } from "@sdk-core/init"
import { GlobalErrorIntegration } from "./integrations/error/GlobalError"

export function initWebSDK(options: any = {}) {
  return init({
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...(options.integrations || [])
    ]
  })
}
10. 使用方式（demo）
apps/demo/index.ts
import { initWebSDK } from "@sdk-web"

const sdk = initWebSDK()

// 测试 error
throw new Error("test error")
11. 运行后你会看到
{
  "id": "...",
  "type": "error",
  "timestamp": 123456,
  "platform": "web",
  "context": {
    "user": {},
    "tags": {},
    "route": "/"
  },
  "payload": {
    "message": "test error"
  }
}