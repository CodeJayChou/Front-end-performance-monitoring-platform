import type { Client, Integration } from "@monitor/sdk-core";
import { createEvent } from "@monitor/event-contract";

/**
 * 包裹 window.fetch，采集 HTTP 请求耗时与结果（性能 + API 监控）。
 * 仅采集原始信号交给 Core，不做 normalize / sampling。
 */
export class FetchIntegration implements Integration {
  name = "Fetch";

  private client?: Client;
  private originalFetch?: typeof window.fetch;

  setup(client: Client): void {
    // 非浏览器环境，或运行时无 fetch 时安全降级
    if (typeof window === "undefined" || typeof window.fetch !== "function") {
      return;
    }

    this.client = client;
    this.originalFetch = window.fetch;
    const originalFetch = this.originalFetch;
    const capture = this.capture.bind(this);

    window.fetch = function patchedFetch(
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const start = performance.now();
      const method = (init?.method ?? "GET").toUpperCase();
      const url = resolveUrl(input);

      return originalFetch.call(this, input, init).then(
        (res) => {
          capture("http", {
            method,
            url,
            status: res.status,
            ok: res.ok,
            duration: performance.now() - start,
          });
          return res;
        },
        (err: unknown) => {
          // 网络层失败（断网 / CORS / abort）：fetch reject，无 status
          capture("http_error", {
            method,
            url,
            error: err instanceof Error ? err.message : String(err),
            duration: performance.now() - start,
          });
          throw err;
        },
      );
    };
  }

  /** 还原被包裹的 fetch，避免重复打补丁。 */
  teardown(): void {
    if (typeof window === "undefined" || !this.originalFetch) return;
    window.fetch = this.originalFetch;
    this.originalFetch = undefined;
  }

  private capture(type: string, payload: Record<string, unknown>): void {
    this.client?.capture(createEvent(type, payload));
  }
}

/** fetch 第一个参数可能是 string / URL / Request，统一取出 url 字符串。 */
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
