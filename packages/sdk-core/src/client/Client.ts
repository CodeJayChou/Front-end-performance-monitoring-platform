import type { BaseEvent } from "@monitor/event-contract";
import type { Integration } from "../integration/Integration";
import type { Transport } from "../transport/Transport";
import { ConsoleTransport } from "../transport/ConsoleTransport";
import { Scope } from "./Scope";
import { MiddlewarePipeline } from "../pipeline/MiddlewarePipeline";
import type { Middleware } from "../pipeline/MiddlewarePipeline";
import {
  createNormalizeMiddleware,
  createEnrichMiddleware,
  createFilterMiddleware,
  createSampleMiddleware,
} from "../pipeline/builtins";

/** beforeSend 钩子：可改写事件，返回 null 表示丢弃。 */
export type BeforeSend = (event: BaseEvent) => BaseEvent | null;

export interface ClientConfig {
  platform: string;
  /** 全局采样率（0~1），默认 1 全量上报。 */
  sampleRate?: number;
  /** 事件出口，默认 ConsoleTransport。 */
  transport?: Transport;
  beforeSend?: BeforeSend;
}

/**
 * 核心事件控制器。只做一件事：event → middleware pipeline → send。
 *
 * 默认 pipeline 由内置 middleware 组成：normalize → enrich(scope) → filter → sample，
 * 业务侧可通过 addMiddleware 插入自定义处理层。Client 不认识任何具体能力，
 * 能力由 Integration 插件注册进来。
 */
export class Client {
  /** 上下文容器，供 enrich 阶段使用，也允许业务侧动态写入。 */
  readonly scope = new Scope();

  /** 可插拔事件处理链。 */
  private readonly pipeline = new MiddlewarePipeline();
  private readonly integrations: Integration[] = [];
  private readonly transport: Transport;
  private readonly beforeSend?: BeforeSend;

  constructor(private readonly config: ClientConfig) {
    this.transport = config.transport ?? new ConsoleTransport();
    this.beforeSend = config.beforeSend;

    // 装上内置 middleware，构成开箱即用的默认 pipeline
    this.pipeline
      .use(createNormalizeMiddleware(this.platform))
      .use(createEnrichMiddleware(this.scope))
      .use(createFilterMiddleware())
      .use(createSampleMiddleware(config.sampleRate ?? 1));
  }

  /** 来源端标识，供插件创建事件时使用。 */
  get platform(): string {
    return this.config.platform;
  }

  /** 读取上下文容器，便于业务侧 setUser / setTag / addBreadcrumb。 */
  getScope(): Scope {
    return this.scope;
  }

  /** 追加一个自定义 middleware 到事件处理链。 */
  addMiddleware(mw: Middleware): this {
    this.pipeline.use(mw);
    return this;
  }

  /** 注册一个能力插件（不立即 setup，配合 setupIntegrations 批量初始化）。 */
  registerIntegration(integration: Integration): void {
    this.integrations.push(integration);
  }

  /** 初始化所有已注册插件（安装 runtime hooks）。 */
  setupIntegrations(): void {
    this.integrations.forEach((integration) => integration.setup(this));
  }

  /** 运行时注册并立即安装一个能力插件（供 DynamicLoader 动态开启使用）。 */
  use(integration: Integration): void {
    this.integrations.push(integration);
    integration.setup(this);
  }

  /** 采集一个事件，经 integration 钩子 + middleware pipeline 处理后送出。 */
  async capture(event: BaseEvent): Promise<void> {
    // 1. integration beforeSend 钩子：进入 pipeline 前的同步增强 / 丢弃
    let incoming: BaseEvent = event;
    for (const integration of this.integrations) {
      if (!integration.beforeSend) continue;
      const result = integration.beforeSend(incoming);
      if (!result) return; // 被某个插件丢弃
      incoming = result;
    }

    // 2. middleware pipeline：normalize → enrich → filter → sample → 自定义层
    const processed = await this.pipeline.execute(incoming);
    if (!processed) return; // 被某一层丢弃

    // 3. beforeSend 钩子：最后一次改写 / 丢弃的机会
    let outgoing: BaseEvent = processed;
    if (this.beforeSend) {
      const result = this.beforeSend(outgoing);
      if (!result) return;
      outgoing = result;
    }

    // 4. 出口
    await this.transport.send(outgoing);
  }
}
