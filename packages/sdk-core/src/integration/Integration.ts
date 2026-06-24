import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "../client/Client";

/**
 * 插件标准接口。任何能力（error / performance / replay …）都通过实现它接入。
 * Core 只认识这个接口，不认识具体能力。
 */
export interface Integration {
  /** 插件名称，便于调试与去重 */
  name: string;
  /** 注册到 Client 时调用，在此安装 runtime hooks */
  setup(client: Client): void;
  /**
   * 可选发送前钩子：在进入 middleware pipeline 之前同步增强 / 丢弃事件。
   * 返回 null 表示该事件被此插件丢弃。
   */
  beforeSend?(event: BaseEvent): BaseEvent | null;
}
