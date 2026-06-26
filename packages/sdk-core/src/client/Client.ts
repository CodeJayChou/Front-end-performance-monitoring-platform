import type { BaseEvent } from "@monitor/event-contract";
import { validateEvent } from "@monitor/event-contract";
import type { Integration } from "../integration/Integration";
import type { Transport } from "../transport/Transport";
import { ConsoleTransport } from "../transport/ConsoleTransport";
import type { Scope } from "../hub/Scope";
import { Hub } from "../hub/Hub";
import { MiddlewarePipeline } from "../middleware/MiddlewarePipeline";
import type { Middleware } from "../middleware/MiddlewarePipeline";
import { createContextMiddleware } from "../middleware/contextMiddleware";
import {
  createNormalizeMiddleware,
  createFilterMiddleware,
  createSampleMiddleware,
} from "../middleware/builtins";
import type { RuntimePlatform } from "../platform/RuntimePlatform";
import { webPlatform } from "../platform/RuntimePlatform";

/** beforeSend 钩子：可改写事件，返回 null 表示丢弃。 */
export type BeforeSend = (event: BaseEvent) => BaseEvent | null;

export interface ClientConfig {
  platform: string;
  /** 全局采样率（0~1），默认 1 全量上报。 */
  sampleRate?: number;
  /** 事件出口，默认 ConsoleTransport。 */
  transport?: Transport;
  beforeSend?: BeforeSend;
  /** 调试模式：打印事件流（integration → scope → middleware → transport）。 */
  debug?: boolean;
  /** 平台适配口（now / uuid / global）；默认 webPlatform（globalThis 兜底）。 */
  runtime?: RuntimePlatform;
}

/**
 * 核心事件控制器 —— 全平台唯一的事件调度入口。
 *
 * capture() 是唯一真入口，固定执行链：
 *   validate → integration.beforeSend → Scope 注入（context + trace）
 *   → middleware pipeline（normalize → context → filter → sample → 自定义）
 *   → beforeSend → transport.send
 *
 * 关键约束：
 *  - Scope 注入发生在 middleware **之前**，middleware 内不再做 scope merge；
 *  - 只有 Client 编排 pipeline / transport，integration 不得绕过它直发。
 */
export class Client {
  /**
   * 唯一的上下文容器：Scope 栈 + context/trace 注入。所有采集路径共享它。
   * 在构造体内、runtime 就绪后再创建（Hub 根 Scope 需要 runtime 作为时钟）。
   */
  private readonly hub: Hub;

  /** 平台适配口：now / uuid / global 的唯一来源，向下分发给 hub / middleware。 */
  private readonly runtime: RuntimePlatform;

  /** 可插拔事件处理链。 */
  private readonly pipeline: MiddlewarePipeline;
  private readonly integrations: Integration[] = [];
  private readonly transport: Transport;
  private readonly beforeSend?: BeforeSend;
  private readonly debug: boolean;

  constructor(private readonly config: ClientConfig) {
    this.runtime = config.runtime ?? webPlatform;
    this.transport = config.transport ?? new ConsoleTransport();
    this.beforeSend = config.beforeSend;
    this.debug = config.debug ?? false;

    // runtime 就绪后再建 Hub：根 Scope 的时钟来自它。
    this.hub = new Hub(this);

    this.pipeline = new MiddlewarePipeline(
      this.debug
        ? (name, event) => this.log(`middleware:${name}`, event)
        : undefined,
    );

    // 默认 pipeline：STRUCTURAL(normalize) → CONTEXTUAL(context) → POLICY(filter, sample)。
    // 阶段序由 MiddlewareType 保证，注册顺序不影响最终执行顺序。
    this.pipeline
      .use(createNormalizeMiddleware(this.platform, this.runtime))
      .use(createContextMiddleware(this.runtime))
      .use(createFilterMiddleware())
      .use(createSampleMiddleware(config.sampleRate ?? 1));
  }

  /** 来源端标识，供插件创建事件时使用。 */
  get platform(): string {
    return this.config.platform;
  }

  /** 唯一的 Hub（上下文 + trace 管理）；Monitor 等应复用它，而非另建。 */
  getHub(): Hub {
    return this.hub;
  }

  /** 平台适配口（now / uuid / global）；hub / integration 等应复用它，而非直接摸全局。 */
  getRuntime(): RuntimePlatform {
    return this.runtime;
  }

  /** 当前作用域（栈顶）。业务侧 setUser / setTag / addBreadcrumb 的入口。 */
  get scope(): Scope {
    return this.hub.getScope();
  }

  /** 读取上下文容器，便于业务侧 setUser / setTag / addBreadcrumb。 */
  getScope(): Scope {
    return this.hub.getScope();
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

  /**
   * 关闭 Client：卸载所有插件的 runtime hooks（teardown），用于 SPA 卸载 / 测试清理。
   */
  close(): void {
    this.integrations.forEach((integration) => integration.teardown?.());
  }

  /**
   * 采集一个事件 —— 平台唯一入口。经校验 → 插件钩子 → Scope 注入 →
   * middleware → beforeSend 后送出。任一环节判定丢弃即静默返回。
   */
  async capture(event: BaseEvent): Promise<void> {
    // 0. 结构校验：脏数据不进入链路
    if (!validateEvent(event)) {
      this.log("drop:invalid", event);
      return;
    }

    // 1. integration.beforeSend：进入 pipeline 前的同步增强 / 丢弃
    const guarded = this.runIntegrations(event);
    if (!guarded) return;

    // 2. context 单点注入：经唯一 Hub 把业务上下文（user/tags/route/breadcrumbs）+ trace 合并进事件
    const scoped = this.hub.applyToEvent(guarded);
    this.log("scope", scoped);

    // 3. middleware pipeline：normalize → context → filter → sample → 自定义层
    const processed = await this.pipeline.execute(scoped);
    if (!processed) return;

    // 4. beforeSend：最后一次改写 / 丢弃的机会
    const outgoing = this.beforeSend ? this.beforeSend(processed) : processed;
    if (!outgoing) return;

    // 5. 出口
    this.log("transport", outgoing);
    await this.transport.send(outgoing);
  }

  /** 依次执行插件 beforeSend；任一返回 null 即丢弃整条事件。 */
  private runIntegrations(event: BaseEvent): BaseEvent | null {
    let current: BaseEvent = event;
    for (const integration of this.integrations) {
      if (!integration.beforeSend) continue;
      const result = integration.beforeSend(current);
      if (!result) {
        this.log(`drop:${integration.name}`, current);
        return null;
      }
      current = result;
    }
    return current;
  }

  /** debug 模式下打印事件流，非 debug 时零开销。 */
  private log(stage: string, event: BaseEvent): void {
    if (!this.debug) return;
    console.log(`[SDK FLOW] ${stage}`, event);
  }
}
