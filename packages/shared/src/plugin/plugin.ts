/**
 * 插件契约。
 *
 * 采集能力（错误 / 性能 / 录制 ...）一律以插件形式接入：
 *   monitor.use(ErrorPlugin).use(PerformancePlugin)...
 * 插件在 setup 时拿到 PluginContext，通过 ctx.bus 投递采集到的事件，
 * 与 core / transport 解耦。
 */
import type { MonitorConfig, MonitorEventMap } from "@monitor/types";
import type { EventBus } from "../event-bus/index.js";

/** 插件注销函数：setup 可返回它以便在 destroy 时清理副作用（解绑监听等）。 */
export type PluginTeardown = () => void;

/** setup 时注入给插件的运行时上下文。 */
export interface PluginContext {
  /** 全局事件总线，插件向此 emit 采集结果。 */
  readonly bus: EventBus<MonitorEventMap>;
  /** 只读的运行时配置。 */
  readonly config: Readonly<MonitorConfig>;
}

/** 监控插件。 */
export interface MonitorPlugin {
  /** 唯一名称，用于去重与日志。 */
  readonly name: string;
  /** 安装插件；可返回注销函数。 */
  setup(ctx: PluginContext): void | PluginTeardown;
}
