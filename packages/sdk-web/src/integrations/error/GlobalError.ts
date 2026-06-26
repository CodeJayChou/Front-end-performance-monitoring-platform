import { BaseIntegration } from "@monitor/sdk-core";

/**
 * 第一个能力插件示例：捕获全局未处理错误（window.onerror）。
 * 新增能力只需新建一个 integration，Core 无需改动。
 */
export class GlobalErrorIntegration extends BaseIntegration {
  name = "GlobalError";

  protected install(): void {
    const previous = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.emit("error", {
        message,
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
