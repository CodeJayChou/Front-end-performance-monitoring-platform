/**
 * @monitor/types — 公共类型契约（仅类型，无运行时代码）。
 */

/** SDK 初始化配置。 */
export interface MonitorConfig {
  appId?: string;
  dsn?: string;
}

/**
 * 全局事件映射：键为事件名，值为载荷类型。
 * 各采集插件按需通过声明合并扩展自己的事件，未知事件回退到 unknown。
 */
export interface MonitorEventMap {
  /** SDK 初始化完成 */
  "monitor:init": MonitorConfig;
  /** 允许插件扩展自定义事件 */
  [event: string]: unknown;
}
