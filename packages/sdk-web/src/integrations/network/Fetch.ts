import { BaseIntegration } from "@monitor/sdk-core";

/**
 * 包裹 window.fetch，采集 HTTP 请求耗时与结果（性能 + API 监控）。
 * 仅采集原始信号交给 Core，不做 normalize / sampling。
 */
export class FetchIntegration extends BaseIntegration {
  name = "Fetch";

  /** 需要运行时存在可用的 fetch。 */
  protected isSupported(): boolean {
    return typeof window !== "undefined" && typeof window.fetch === "function";
  }

  protected install(): void {
    const originalFetch = window.fetch;
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
    // 还原被包裹的 fetch，避免重复打补丁
    this.onCleanup(() => {
      window.fetch = originalFetch;
    });
  }

  private capture(type: string, payload: Record<string, unknown>): void {
    this.emit(type, payload);
  }
}

/** fetch 第一个参数可能是 string / URL / Request，统一取出 url 字符串。 */
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
