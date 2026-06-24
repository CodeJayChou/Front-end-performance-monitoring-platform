import type { BaseEvent } from "@monitor/event-contract";
import type { Transport } from "./Transport";

/**
 * ConsoleTransport —— 默认出口实现。
 * 第一阶段不接网络，直接把事件打到 console，用于本地验证整条 pipeline 是否跑通。
 */
export class ConsoleTransport implements Transport {
  send(event: BaseEvent): void {
    console.log("[SDK EVENT]", event);
  }
}
