import { Client } from "./client/Client";
import type { BeforeSend } from "./client/Client";
import type { Integration } from "./integration/Integration";
import type { Transport } from "./transport/Transport";
import { HttpTransport } from "./transport/HttpTransport";

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
}

/**
 * SDK 初始化入口：本质是“初始化事件管道 + 注册事件来源插件”。
 *
 * init(options) → new Client → 注册 integrations → setupIntegrations。
 */
export function init(options: SDKOptions = {}): Client {
  // 出口选择：显式 transport 优先；否则有 dsn 走 HttpTransport，最后回落 ConsoleTransport（Client 内部默认）。
  const transport =
    options.transport ??
    (options.dsn ? new HttpTransport({ endpoint: options.dsn }) : undefined);

  const client = new Client({
    platform: options.platform || "web",
    sampleRate: options.sampleRate,
    transport,
    beforeSend: options.beforeSend,
    debug: options.debug,
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
export { contextMiddleware } from "./middleware/contextMiddleware";
export { normalize } from "./middleware/normalize";
export { filter } from "./middleware/filter";
export { sample } from "./middleware/sampling";

/* ── Event Contract 再导出（单一入口拿到核心契约）────── */
export type { BaseEvent, EventType, TraceContext } from "@monitor/event-contract";
export { createEvent, validateEvent } from "@monitor/event-contract";
