import type { BaseEvent } from "@monitor/event-contract";
import type { Transport } from "./Transport";

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

interface BeaconRuntime {
  fetch?: typeof fetch;
  navigator?: { sendBeacon?: (url: string, data?: string) => boolean };
}

/**
 * HttpTransport —— 网络出口实现（生产级加固版）。
 *
 * 经 pipeline 处理后的事件，通过 fetch POST 到 endpoint。能力：
 *  - keepalive：页面卸载时仍尽力送达；
 *  - 重试：网络失败最多重试 maxRetries 次（默认 2，共 3 次尝试）；
 *  - sendBeacon 兜底：无 fetch 时退化到 navigator.sendBeacon。
 *
 * 设计约束：监控 SDK 绝不能把自身故障抛回宿主应用。
 * 因此这里吞掉所有网络异常，并在无可用出口（SSR / 老旧 runtime）时安全降级。
 */
export class HttpTransport implements Transport {
  private readonly endpoint: string;
  private readonly keepalive: boolean;
  private readonly maxRetries: number;

  constructor(options: HttpTransportOptions) {
    this.endpoint = options.endpoint;
    this.keepalive = options.keepalive ?? true;
    this.maxRetries = options.maxRetries ?? 2;
  }

  async send(event: BaseEvent): Promise<void> {
    const runtime = globalThis as BeaconRuntime;
    const body = JSON.stringify(event);

    if (typeof runtime.fetch === "function") {
      await this.sendWithFetch(runtime.fetch, body);
      return;
    }

    // 无 fetch：退化到 sendBeacon（卸载场景常用），再不行就安全降级。
    runtime.navigator?.sendBeacon?.(this.endpoint, body);
  }

  /** fetch 上报，失败按 maxRetries 重试；全部失败则 sendBeacon 兜底。 */
  private async sendWithFetch(
    fetchFn: typeof fetch,
    body: string,
  ): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await fetchFn(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: this.keepalive,
        });
        return; // 成功即结束
      } catch {
        // 最后一次仍失败：尝试 sendBeacon 兜底，仍失败则放弃（不抛错）。
        if (attempt === this.maxRetries) {
          (globalThis as BeaconRuntime).navigator?.sendBeacon?.(
            this.endpoint,
            body,
          );
        }
      }
    }
  }
}
