/**
 * @monitor/sdk-core — SDK 核心：插件宿主 + 事件总线持有者。
 *
 * 本身不实现任何采集逻辑，只负责：
 *   1. 持有全局 EventBus；
 *   2. 通过 use() 注册插件、init() 时统一安装；
 *   3. 把 PluginContext（bus + config）注入各插件。
 *
 * @example
 * monitor
 *   .use(ErrorPlugin)
 *   .use(PerformancePlugin)
 *   .use(ReplayPlugin)
 *   .init({ appId: "demo-app" });
 */
import { EventBus, type MonitorPlugin, type PluginTeardown } from "@monitor/shared";
import type { MonitorConfig, MonitorEventMap } from "@monitor/types";

export class MonitorSDK {
  readonly #bus = new EventBus<MonitorEventMap>();
  readonly #plugins = new Map<string, MonitorPlugin>();
  readonly #teardowns: PluginTeardown[] = [];
  #config: MonitorConfig = {};
  #started = false;

  /** 全局事件总线访问入口（高级用法 / 测试）。 */
  get bus(): EventBus<MonitorEventMap> {
    return this.#bus;
  }

  /**
   * 注册插件，支持链式调用。
   * init 之前注册会在 init 时统一安装；init 之后注册则立即安装。
   */
  use(plugin: MonitorPlugin): this {
    if (this.#plugins.has(plugin.name)) {
      console.warn(`[monitor] 插件 "${plugin.name}" 已注册，忽略重复注册`);
      return this;
    }
    this.#plugins.set(plugin.name, plugin);
    if (this.#started) this.#setup(plugin);
    return this;
  }

  /** 初始化 SDK：写入配置并安装所有已注册插件。 */
  init(config: MonitorConfig = {}): this {
    if (this.#started) {
      console.warn("[monitor] 已初始化，忽略重复 init");
      return this;
    }
    this.#config = config;
    this.#started = true;
    for (const plugin of this.#plugins.values()) this.#setup(plugin);
    this.#bus.emit("monitor:init", config);
    return this;
  }

  /** 注销全部插件与监听，恢复到未初始化状态。 */
  destroy(): void {
    for (const teardown of this.#teardowns.splice(0)) teardown();
    this.#plugins.clear();
    this.#bus.clear();
    this.#config = {};
    this.#started = false;
  }

  #setup(plugin: MonitorPlugin): void {
    const teardown = plugin.setup({ bus: this.#bus, config: this.#config });
    if (teardown) this.#teardowns.push(teardown);
  }
}

const monitor = new MonitorSDK();
export default monitor;
