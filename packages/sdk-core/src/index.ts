import { Client } from "./client/Client";
import type { BeforeSend } from "./client/Client";
import type { Integration } from "./integration/Integration";
import type { Transport } from "./transport/Transport";

export interface SDKOptions {
  /** 上报地址（第一阶段未使用，预留） */
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
}

/**
 * SDK 初始化入口：本质是“初始化事件管道 + 注册事件来源插件”。
 *
 * init(options) → new Client → 注册 integrations → setupIntegrations。
 */
export function init(options: SDKOptions = {}): Client {
  const client = new Client({
    platform: options.platform || "web",
    sampleRate: options.sampleRate,
    transport: options.transport,
    beforeSend: options.beforeSend,
  });

  // 1. 注册 integrations
  options.integrations?.forEach((integration) => {
    client.registerIntegration(integration);
  });

  // 2. 初始化 integrations（安装 runtime hooks）
  client.setupIntegrations();

  return client;
}

export { Client } from "./client/Client";
export type { ClientConfig, BeforeSend } from "./client/Client";
export { Hub } from "./client/Hub";
export { Monitor } from "./client/Monitor";
export { Scope } from "./client/Scope";
export type { Breadcrumb } from "./client/Scope";
export type { Integration } from "./integration/Integration";
export { IntegrationManager } from "./integration/IntegrationManager";
export { IntegrationRegistry } from "./integration/registry";
export { DynamicLoader } from "./integration/DynamicLoader";
export type { Transport } from "./transport/Transport";
export { ConsoleTransport } from "./transport/ConsoleTransport";
export { MiddlewarePipeline } from "./pipeline/MiddlewarePipeline";
export type { Middleware, Next } from "./pipeline/MiddlewarePipeline";
export {
  BUILTIN_PRIORITY,
  createNormalizeMiddleware,
  createEnrichMiddleware,
  createFilterMiddleware,
  createSampleMiddleware,
} from "./pipeline/builtins";
export { contextMiddleware } from "./pipeline/contextMiddleware";
export { normalize } from "./pipeline/normalize";
export { enrich } from "./pipeline/enrich";
export { filter } from "./pipeline/filter";
export { sample } from "./pipeline/sampling";
