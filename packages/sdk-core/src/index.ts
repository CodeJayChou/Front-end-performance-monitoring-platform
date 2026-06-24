import { Client } from "./client/Client";
import type { BeforeSend } from "./client/Client";
import type { Integration } from "./integration/Integration";

export interface SDKOptions {
  /** 上报地址（第一阶段未使用，预留） */
  dsn?: string;
  /** 来源端标识，默认 "web" */
  platform?: string;
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
export type { Integration } from "./integration/Integration";
export { IntegrationManager } from "./integration/IntegrationManager";
