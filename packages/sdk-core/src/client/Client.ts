import type { BaseEvent } from "@monitor/event-contract";
import type { Integration } from "../integration/Integration";

/** beforeSend 钩子：可改写事件，返回 null 表示丢弃。 */
export type BeforeSend = (event: BaseEvent) => BaseEvent | null;

export interface ClientConfig {
  platform: string;
  beforeSend?: BeforeSend;
}

/**
 * 核心事件控制器。只做一件事：event → process → send。
 * 它不认识任何具体能力，能力由 Integration 插件注册进来。
 */
export class Client {
  private readonly integrations: Integration[] = [];
  private readonly beforeSend?: BeforeSend;

  constructor(private readonly config: ClientConfig) {
    this.beforeSend = config.beforeSend;
  }

  /** 来源端标识，供插件创建事件时使用。 */
  get platform(): string {
    return this.config.platform;
  }

  /** 注册一个能力插件。 */
  registerIntegration(integration: Integration): void {
    this.integrations.push(integration);
  }

  /** 初始化所有已注册插件（安装 runtime hooks）。 */
  setupIntegrations(): void {
    this.integrations.forEach((integration) => integration.setup(this));
  }

  /** 采集一个事件，经 beforeSend 处理后送出。 */
  capture(event: BaseEvent): void {
    let processed: BaseEvent | null = event;

    if (this.beforeSend) {
      processed = this.beforeSend(processed);
      if (!processed) return; // 钩子返回 null → 丢弃事件
    }

    this.send(processed);
  }

  /** 事件出口（第一阶段直接打印，后续替换为 transport）。 */
  private send(event: BaseEvent): void {
    console.log("[SDK EVENT]", event);
  }
}
