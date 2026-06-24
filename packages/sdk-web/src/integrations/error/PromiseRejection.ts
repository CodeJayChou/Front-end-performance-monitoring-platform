import type { Client, Integration } from "@monitor/sdk-core";
import { createEvent } from "@monitor/event-contract";

/**
 * 捕获未处理的 Promise 拒绝（window 'unhandledrejection'）。
 * 只负责把 runtime 信号转成统一事件交给 Core，不做 normalize / filter。
 */
export class PromiseRejectionIntegration implements Integration {
  name = "PromiseRejection";

  private client?: Client;
  private readonly onRejection = (event: PromiseRejectionEvent): void => {
    this.client?.capture(
      createEvent("promise_rejection", {
        reason: this.serializeReason(event.reason),
        // reject 值若为 Error，尽量保留 stack 便于定位
        stack:
          event.reason instanceof Error ? event.reason.stack : undefined,
      }),
    );
  };

  setup(client: Client): void {
    // 非浏览器环境（SSR / Node）安全降级
    if (typeof window === "undefined") return;

    this.client = client;
    window.addEventListener("unhandledrejection", this.onRejection);
  }

  /** 卸载监听，避免重复注册 / 内存泄漏。 */
  teardown(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("unhandledrejection", this.onRejection);
  }

  /** reason 可能是任意值（Error / string / 对象），转成可上报的纯净结构。 */
  private serializeReason(reason: unknown): string {
    if (reason instanceof Error) return reason.message;
    if (typeof reason === "string") return reason;
    try {
      return JSON.stringify(reason);
    } catch {
      return String(reason);
    }
  }
}
