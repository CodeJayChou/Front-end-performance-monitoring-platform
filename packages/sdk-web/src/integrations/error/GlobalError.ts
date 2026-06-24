import type { Client, Integration } from "@monitor/sdk-core";
import { createEvent } from "@monitor/event-contract";

/**
 * 第一个能力插件示例：捕获全局未处理错误（window.onerror）。
 * 新增能力只需新建一个 integration，Core 无需改动。
 */
export class GlobalErrorIntegration implements Integration {
  name = "GlobalError";

  setup(client: Client): void {
    // 非浏览器环境（SSR / Node）安全降级
    if (typeof window === "undefined") return;

    window.onerror = (message, source, lineno, colno, error) => {
      client.capture(
        createEvent("error", {
          message,
          source,
          lineno,
          colno,
          stack: error?.stack,
        }),
      );
      return false; // 不阻止浏览器默认的错误输出
    };
  }
}
