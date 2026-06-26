import { Client } from "./client/Client";
import type { BeforeSend } from "./client/Client";
import type { Integration } from "./integration/Integration";
import type { Transport } from "./transport/Transport";
import { HttpTransport } from "./transport/HttpTransport";
import type { RuntimePlatform } from "./platform/RuntimePlatform";
import { webPlatform } from "./platform/RuntimePlatform";
import type { DedupOptions } from "./middleware/dedup";
import type { RateLimitOptions } from "./middleware/rateLimit";
import type { StackParser } from "./middleware/stackNormalize";

export interface SDKOptions {
  /** 上报地址；提供后默认走 HttpTransport（fetch + keepalive）上报到该地址 */
  dsn?: string;
  /** 来源端标识，默认 "web" */
  platform?: string;
  /** 全局采样率（0~1），默认 1 全量上报 */
  sampleRate?: number;
  /** 事件出口，默认 ConsoleTransport */
  transport?: Transport;
  /** 能力插件列表 */
  integrations?: Integration[];
  /** 发送前钩子：可改写或丢弃事件 */
  beforeSend?: BeforeSend;
  /** 调试模式：打印事件流（integration → scope → middleware → transport） */
  debug?: boolean;
  /** 平台适配口（now / uuid / global）；默认 webPlatform，跨端时由各端注入 */
  runtime?: RuntimePlatform;
  /** 跨端栈解析器；提供后把错误 stack 解析为结构化 stackFrames（web 由 sdk-web 默认注入） */
  stackParser?: StackParser;
  /** 去重配置；默认开启（仅错误事件、5s 窗口），传 false 关闭 */
  dedup?: DedupOptions | false;
  /** 限流配置；默认开启（全局令牌桶 100/50），传 false 关闭 */
  rateLimit?: RateLimitOptions | false;
}

/**
 * SDK 初始化入口：本质是“初始化事件管道 + 注册事件来源插件”。
 *
 * init(options) → new Client → 注册 integrations → setupIntegrations。
 */
export function init(options: SDKOptions = {}): Client {
  const runtime = options.runtime ?? webPlatform;

  // 出口选择：显式 transport 优先；否则有 dsn 走 HttpTransport（共享同一 runtime），最后回落 ConsoleTransport（Client 内部默认）。
  const transport =
    options.transport ??
    (options.dsn
      ? new HttpTransport({ endpoint: options.dsn }, runtime)
      : undefined);

  const client = new Client({
    platform: options.platform || "web",
    sampleRate: options.sampleRate,
    transport,
    beforeSend: options.beforeSend,
    debug: options.debug,
    runtime,
    stackParser: options.stackParser,
    dedup: options.dedup,
    rateLimit: options.rateLimit,
  });

  // 1. 注册 integrations
  options.integrations?.forEach((integration) => {
    client.registerIntegration(integration);
  });

  // 2. 初始化 integrations（安装 runtime hooks）
  client.setupIntegrations();

  return client;
}

/* ── Client（事件采集入口）────────────────────────────── */
export { Client } from "./client/Client";
export type { ClientConfig, BeforeSend } from "./client/Client";

/* ── Hub / Scope（上下文与链路）──────────────────────── */
export { Hub } from "./hub/Hub";
export { Monitor } from "./hub/Monitor";
export { Scope } from "./hub/Scope";
export type { Breadcrumb } from "./hub/Scope";

/* ── Integration（插件体系）──────────────────────────── */
export type { Integration } from "./integration/Integration";
export { BaseIntegration } from "./integration/BaseIntegration";
export { IntegrationManager } from "./integration/IntegrationManager";
export { IntegrationRegistry } from "./integration/registry";
export { DynamicLoader } from "./integration/DynamicLoader";

/* ── Transport（事件出口）────────────────────────────── */
export type { Transport } from "./transport/Transport";
export type { HttpTransportOptions } from "./transport/HttpTransport";
export { ConsoleTransport } from "./transport/ConsoleTransport";
export { HttpTransport } from "./transport/HttpTransport";

/* ── Middleware（事件管道）──────────────────────────── */
export { MiddlewarePipeline, MiddlewareType } from "./middleware/MiddlewarePipeline";
export type { Middleware, Next, MiddlewareTap } from "./middleware/MiddlewarePipeline";
export {
  BUILTIN_PRIORITY,
  createNormalizeMiddleware,
  createFilterMiddleware,
  createSampleMiddleware,
} from "./middleware/builtins";
export {
  contextMiddleware,
  createContextMiddleware,
} from "./middleware/contextMiddleware";
export { normalize } from "./middleware/normalize";
export { filter } from "./middleware/filter";
export { sample } from "./middleware/sampling";
export {
  createDedupMiddleware,
  fingerprint,
  TtlDedupStore,
} from "./middleware/dedup";
export type { DedupOptions, DedupStore } from "./middleware/dedup";
export { createRateLimitMiddleware, TokenBucket } from "./middleware/rateLimit";
export type { RateLimitOptions } from "./middleware/rateLimit";
export { createStackNormalizeMiddleware } from "./middleware/stackNormalize";
export type { StackParser } from "./middleware/stackNormalize";
export { fnv1a } from "./util/hash";

/* ── Platform Adapter（运行时适配口：now / uuid / global）──── */
export type {
  RuntimePlatform,
  RuntimeGlobal,
} from "./platform/RuntimePlatform";
export { webPlatform } from "./platform/RuntimePlatform";

/* ── Event Contract 再导出（单一入口拿到核心契约）────── */
export type {
  BaseEvent,
  EventType,
  TraceContext,
  EventRuntime,
} from "@monitor/event-contract";
export { createEvent, validateEvent, defaultRuntime } from "@monitor/event-contract";
