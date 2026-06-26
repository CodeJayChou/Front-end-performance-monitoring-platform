import { BaseIntegration } from "@monitor/sdk-core";
import type { PromiseRejectionPayload } from "@monitor/event-contract";

/**
 * 捕获未处理的 Promise 拒绝（window 'unhandledrejection'）。
 * 只负责把 runtime 信号转成统一事件交给 Core，不做 normalize / filter。
 *
 * 上报 `type:"error"` + `kind:"promise"`，与 JS 运行时错误（kind:"js"）/ 资源错误
 * （kind:"resource"）同挂在统一的 error 事件下，由 `kind` 判别。
 */
export class PromiseRejectionIntegration extends BaseIntegration {
  name = "PromiseRejection";

  private readonly onRejection = (event: PromiseRejectionEvent): void => {
    this.emit<PromiseRejectionPayload>("error", {
      kind: "promise",
      reason: this.serializeReason(event.reason),
      // reject 值若为 Error，尽量保留 stack 便于定位
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    });
  };

  protected install(): void {
    window.addEventListener("unhandledrejection", this.onRejection);
    this.onCleanup(() =>
      window.removeEventListener("unhandledrejection", this.onRejection),
    );
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
