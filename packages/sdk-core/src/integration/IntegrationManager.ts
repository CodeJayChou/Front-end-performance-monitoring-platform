import type { Integration } from "./Integration";
import type { Client } from "../client/Client";

/**
 * 插件管理器（可选）。当需要在注册到 Client 之前先收集/编排一批插件时使用。
 */
export class IntegrationManager {
  private readonly integrations: Integration[] = [];

  add(integration: Integration): void {
    this.integrations.push(integration);
  }

  setupAll(client: Client): void {
    this.integrations.forEach((integration) => integration.setup(client));
  }
}
