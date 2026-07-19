import type { BaseEvent } from "@monitor/event-contract";
import type { RuntimePlatform } from "../platform/RuntimePlatform";
import { webPlatform } from "../platform/RuntimePlatform";
import type { Transport } from "./Transport";

export interface BatchHttpTransportOptions {
  endpoint: string;
  projectId: string;
  sdkKey: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  keepalive?: boolean;
}

interface BatchBody {
  projectId: string;
  sdkKey: string;
  events: BaseEvent[];
}

/**
 * MVP 网络出口：先入内存队列，再按批次发送。
 *
 * 关键安全约束：在构造时捕获原始 fetch。Web FetchIntegration 之后即使 patch
 * 全局 fetch，上报请求也不会再次被采集，避免 dsn 自监控递归。
 */
export class BatchHttpTransport implements Transport {
  private readonly endpoint: string;
  private readonly projectId: string;
  private readonly sdkKey: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly keepalive: boolean;
  private readonly fetchFn: typeof fetch | undefined;
  private queue: BaseEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flushing: Promise<void> | undefined;
  private closed = false;

  constructor(
    options: BatchHttpTransportOptions,
    private readonly runtime: RuntimePlatform = webPlatform,
  ) {
    this.endpoint = options.endpoint;
    this.projectId = options.projectId;
    this.sdkKey = options.sdkKey;
    this.batchSize = Math.max(1, options.batchSize ?? 50);
    this.flushIntervalMs = Math.max(0, options.flushIntervalMs ?? 3_000);
    this.maxQueueSize = Math.max(this.batchSize, options.maxQueueSize ?? 1_000);
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 5_000);
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    this.keepalive = options.keepalive ?? true;
    // Must happen before Web integrations install their global patches.
    this.fetchFn = runtime.global.fetch;
  }

  send(event: BaseEvent): Promise<void> {
    if (this.closed) return Promise.resolve();

    this.queue.push(event);
    if (this.queue.length > this.maxQueueSize) {
      this.queue.splice(0, this.queue.length - this.maxQueueSize);
    }

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
    return Promise.resolve();
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      await this.flushing;
      return;
    }
    if (this.queue.length === 0) return;

    this.clearTimer();
    this.flushing = (async () => {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        const handled = await this.sendBatch({
          projectId: this.projectId,
          sdkKey: this.sdkKey,
          events: batch,
        });
        if (!handled) {
          this.queue.unshift(...batch);
          break;
        }
      }
    })().finally(() => {
      this.flushing = undefined;
      if (this.queue.length > 0 && !this.closed) this.scheduleFlush();
    });
    return this.flushing;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.clearTimer();
    await this.flush();
  }

  private scheduleFlush(): void {
    if (this.timer || this.closed) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.flushIntervalMs);
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async sendBatch(body: BatchBody): Promise<boolean> {
    let serialized: string;
    try {
      serialized = JSON.stringify(body);
    } catch {
      return true;
    }

    if (this.fetchFn) {
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        const controller =
          typeof AbortController !== "undefined" ? new AbortController() : undefined;
        const timeout = controller
          ? setTimeout(() => controller.abort(), this.timeoutMs)
          : undefined;

        try {
          const response = await this.fetchFn(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: serialized,
            keepalive: this.keepalive,
            signal: controller?.signal,
          });
          if (timeout) clearTimeout(timeout);
          if (response.ok || (response.status >= 200 && response.status < 300)) return true;
          // A permanent client error must not block every later event.
          if (!this.isRetryable(response.status)) return true;
        } catch {
          if (timeout) clearTimeout(timeout);
        }

        if (attempt < this.maxRetries) await this.backoff(attempt);
      }
    }

    // Best effort fallback for unload/old runtimes. Failure is intentionally swallowed.
    return this.runtime.global.navigator?.sendBeacon?.(this.endpoint, serialized) === true;
  }

  private isRetryable(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(2_000, 100 * 2 ** attempt);
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
}
