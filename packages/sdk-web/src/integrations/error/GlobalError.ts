import { BaseIntegration } from "@monitor/sdk-core";
import type { JsErrorPayload } from "@monitor/event-contract";

/**
 * 第一个能力插件示例：捕获全局未处理错误（window.onerror）。
 * 新增能力只需新建一个 integration，Core 无需改动。
 *
 * 上报 `type:"error"` + `kind:"js"`，与资源错误（kind:"resource"）/ Promise 拒绝
 * （kind:"promise"）同挂在统一的 error 事件下，由 `kind` 判别。
 */
export class GlobalErrorIntegration extends BaseIntegration {
  name = "GlobalError";

  protected install(): void {
    const previous = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.emit<JsErrorPayload>("error", {
        kind: "js",
        // onerror 的 message 形参为 string | Event，统一转成可读字符串
        message: typeof message === "string" ? message : String(message),
        source,
        lineno,
        colno,
        stack: error?.stack,
      });
      return false; // 不阻止浏览器默认的错误输出
    };
    // 还原此前的 onerror，避免重复 setup / SPA 卸载时丢失原处理器
    this.onCleanup(() => {
      window.onerror = previous;
    });
  }
}
