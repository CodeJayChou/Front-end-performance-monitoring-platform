import type { BaseEvent } from "@monitor/event-contract";
import type { Transport } from "./Transport";
import type { RuntimePlatform } from "../platform/RuntimePlatform";
import { webPlatform } from "../platform/RuntimePlatform";

export interface HttpTransportOptions {
  /** 上报地址（dsn / ingest endpoint）。 */
  endpoint: string;
  /**
   * 是否在页面卸载时仍尽力送达。
   * 默认 true：依赖 fetch 的 keepalive，让请求脱离页面生命周期继续发送。
   */
  keepalive?: boolean;
  /** 失败重试次数（不含首次），默认 2（即最多尝试 3 次）。 */
  maxRetries?: number;
}

/**
 * HttpTransport —— 网络出口实现（生产级加固版）。
 *
 * 经 pipeline 处理后的事件，通过 fetch POST 到 endpoint。能力：
 *  - keepalive：页面卸载时仍尽力送达；
 *  - 重试：网络失败最多重试 maxRetries 次（默认 2，共 3 次尝试）；
 *  - sendBeacon 兜底：无 fetch 时退化到 navigator.sendBeacon。
 *
 * fetch / sendBeacon 从注入的 `RuntimePlatform.global` 取，不再直接摸 `globalThis`，
 * 故小程序 / RN 只需提供各自的 global（如包装 `wx.request`）即可复用本实现。
 *
 * 设计约束：监控 SDK 绝不能把自身故障抛回宿主应用。
 * 因此这里吞掉所有网络异常，并在无可用出口（SSR / 老旧 runtime）时安全降级。
 */
export class HttpTransport implements Transport {
  private readonly endpoint: string;
  private readonly keepalive: boolean;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch | undefined;

  constructor(
    options: HttpTransportOptions,
    private readonly runtime: RuntimePlatform = webPlatform,
  ) {
    this.endpoint = options.endpoint;
    this.keepalive = options.keepalive ?? true;
    this.maxRetries = options.maxRetries ?? 2;
    // Capture before integrations patch global fetch; this also prevents self-instrumentation.
    this.fetchFn = runtime.global.fetch;
  }

  async send(event: BaseEvent): Promise<void> {
    const g = this.runtime.global;
    let body: string;
    try {
      body = JSON.stringify(event);
    } catch {
      return;
    }

    if (this.fetchFn) {
      await this.sendWithFetch(this.fetchFn, body);
      return;
    }

    // 无 fetch：退化到 sendBeacon（卸载场景常用），再不行就安全降级。
    g.navigator?.sendBeacon?.(this.endpoint, body);
  }

  /** fetch 上报，失败按 maxRetries 重试；全部失败则 sendBeacon 兜底。 */
  private async sendWithFetch(
    fetchFn: typeof fetch,
    body: string,
  ): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetchFn(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: this.keepalive,
        });
        if (response.ok || (response.status >= 200 && response.status < 300)) return;
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) return;
        if (attempt === this.maxRetries) {
          this.runtime.global.navigator?.sendBeacon?.(this.endpoint, body);
          return;
        }
      } catch {
        // 最后一次仍失败：尝试 sendBeacon 兜底，仍失败则放弃（不抛错）。
        if (attempt === this.maxRetries) {
          this.runtime.global.navigator?.sendBeacon?.(this.endpoint, body);
        }
      }
      if (attempt < this.maxRetries) {
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(2_000, 100 * 2 ** attempt)));
      }
    }
  }
}
