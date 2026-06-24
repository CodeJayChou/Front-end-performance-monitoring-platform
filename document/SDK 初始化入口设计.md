1. 总体设计（你要先理解这个结构）

初始化后的结构是：

init(config)
   ↓
createClient()
   ↓
register integrations (plugins)
   ↓
setup runtime hooks
   ↓
emit event → pipeline → transport

核心三件事：

Client（事件控制中心）
Integration（能力插件）
Plugin System（注册机制）
2. SDK 初始化入口（对外 API）
packages/sdk-core/src/index.ts
import { Client } from "./client/Client"
import { Integration } from "./integration/Integration"
import { createEvent } from "@event-contract"

export interface SDKOptions {
  dsn?: string
  platform?: string
  integrations?: Integration[]
  beforeSend?: (event: any) => any | null
}

export function init(options: SDKOptions = {}) {
  const client = new Client({
    platform: options.platform || "web",
    beforeSend: options.beforeSend
  })

  // 1. 注册 integrations
  if (options.integrations?.length) {
    options.integrations.forEach((integration) => {
      client.registerIntegration(integration)
    })
  }

  // 2. 初始化 integrations
  client.setupIntegrations()

  return client
}
3. Client（核心事件控制器）
packages/sdk-core/src/client/Client.ts
import { Integration } from "../integration/Integration"

export interface ClientConfig {
  platform: string
  beforeSend?: (event: any) => any | null
}

export class Client {
  private integrations: Integration[] = []
  private beforeSend?: (event: any) => any | null

  constructor(private config: ClientConfig) {
    this.beforeSend = config.beforeSend
  }

  registerIntegration(integration: Integration) {
    this.integrations.push(integration)
  }

  setupIntegrations() {
    this.integrations.forEach((integration) => {
      integration.setup(this)
    })
  }

  capture(event: any) {
    let processed = event

    // beforeSend hook
    if (this.beforeSend) {
      processed = this.beforeSend(processed)
      if (!processed) return
    }

    this.send(processed)
  }

  private send(event: any) {
    console.log("[SDK EVENT]", event)
  }
}
4. Integration（插件标准接口）
packages/sdk-core/src/integration/Integration.ts
import { Client } from "../client/Client"

export interface Integration {
  name: string
  setup(client: Client): void
}
5. Integration Manager（可选但推荐）
import { Integration } from "./Integration"
import { Client } from "../client/Client"

export class IntegrationManager {
  private integrations: Integration[] = []

  add(integration: Integration) {
    this.integrations.push(integration)
  }

  setupAll(client: Client) {
    this.integrations.forEach((i) => i.setup(client))
  }
}
6. Event Contract（最小版）
packages/event-contract/src/index.ts
export interface BaseEvent {
  id: string
  type: string
  timestamp: number
  platform: string
  payload: any
}

export function createEvent(type: string, payload: any): BaseEvent {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    platform: "web",
    payload
  }
}
7. Web Integration（第一个插件示例）
packages/sdk-web/src/integrations/error/GlobalError.ts
import { Integration } from "@sdk-core/integration/Integration"
import { createEvent } from "@event-contract"

export class GlobalErrorIntegration implements Integration {
  name = "GlobalError"

  setup(client: any) {
    window.onerror = (msg, src, line, col, err) => {
      client.capture(
        createEvent("error", {
          message: msg,
          stack: err?.stack,
          source: src,
          line,
          col
        })
      )
    }
  }
}
8. SDK Web 初始化入口
packages/sdk-web/src/index.ts
import { init } from "@sdk-core"
import { GlobalErrorIntegration } from "./integrations/error/GlobalError"

export function initWebSDK(options: any = {}) {
  return init({
    platform: "web",
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...(options.integrations || [])
    ]
  })
}
9. 使用方式（最终用户视角）
apps/demo-web/src/index.ts
import { initWebSDK } from "@sdk-web"

const client = initWebSDK({
  beforeSend(event) {
    // 过滤敏感数据
    return event
  }
})

// 测试
throw new Error("test error")
10. 你现在得到的架构能力
✔ 插件系统成立
class XXXIntegration implements Integration
✔ SDK 可扩展

新增能力只需要：

sdk-web/integrations/new-feature
✔ Core 完全稳定

Core 不知道：

error
performance
replay

只知道：

event → process → send
11. 这个设计的本质（很重要）

你现在已经有三层：

1. Event Contract   （语言）
2. SDK Core         （流水线）
3. Integration      （能力插件）
12. 一句话总结

SDK 初始化入口的本质不是“初始化功能”，而是“初始化事件管道 + 注册事件来源插件”。