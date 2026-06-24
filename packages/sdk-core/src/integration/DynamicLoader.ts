import type { Client } from "../client/Client";
import type { IntegrationRegistry } from "./registry";

/**
 * DynamicLoader —— 运行时按需开启能力插件。
 *
 * 把 registry（能力清单）与 client（运行时容器）连接起来：enable(name) 时
 * 从 registry 创建插件实例并安装到 client。由此实现「不改 SDK core、运行时
 * 开关能力、按需加载」。
 */
export class DynamicLoader {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly client: Client,
  ) {}

  /** 开启一个已登记的能力；未登记则静默忽略。 */
  enable(name: string): void {
    const integration = this.registry.create(name);
    if (!integration) return;

    // use 会同时完成注册与 setup（安装 runtime hooks）
    this.client.use(integration);
  }
}
