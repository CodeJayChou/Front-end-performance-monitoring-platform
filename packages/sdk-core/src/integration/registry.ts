import type { Integration } from "./Integration";

/**
 * IntegrationRegistry —— 插件工厂注册表。
 *
 * 以「名称 → 工厂函数」的形式登记可用能力，create(name) 时才真正实例化。
 * 这是“运行时可扩展”的基础：能力只登记不创建，按需开启时再 new。
 */
export class IntegrationRegistry {
  private readonly factories = new Map<string, () => Integration>();

  /** 登记一个插件工厂。 */
  register(name: string, factory: () => Integration): this {
    this.factories.set(name, factory);
    return this;
  }

  /** 按名称创建插件实例；未登记返回 null。 */
  create(name: string): Integration | null {
    const factory = this.factories.get(name);
    return factory ? factory() : null;
  }

  /** 是否已登记某能力。 */
  has(name: string): boolean {
    return this.factories.has(name);
  }
}
