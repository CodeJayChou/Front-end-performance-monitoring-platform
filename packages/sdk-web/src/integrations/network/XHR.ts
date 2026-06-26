import { BaseIntegration } from "@monitor/sdk-core";

/** 每个 xhr 实例的采集上下文，挂在 WeakMap 上避免污染实例字段。 */
interface XHRMeta {
  method: string;
  url: string;
  start: number;
}

/**
 * 包裹 XMLHttpRequest.open / send，采集 HTTP 请求耗时与结果（性能 + API 监控）。
 *
 * 语义与 FetchIntegration 对齐：拿到响应即视为完成（含 4xx/5xx）上报 "http"；
 * 网络层失败（error / timeout / abort，status 恒为 0）上报 "http_error"。
 * 仅采集原始信号交给 Core，不做 normalize / sampling。
 */
export class XHRIntegration extends BaseIntegration {
  name = "XHR";

  /** open 阶段记录 method/url，send 阶段记录起始时间，按实例隔离。 */
  private readonly meta = new WeakMap<XMLHttpRequest, XHRMeta>();

  /** 需要运行时存在 XMLHttpRequest。 */
  protected isSupported(): boolean {
    return typeof XMLHttpRequest !== "undefined";
  }

  protected install(): void {
    const proto = XMLHttpRequest.prototype;
    const meta = this.meta;
    const emit = this.emit.bind(this);

    const originalOpen = proto.open;
    const originalSend = proto.send;

    proto.open = function patchedOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ): void {
      // open 拿不到时长，只记录请求标识，留到 send/loadend 用
      meta.set(this, {
        method: method.toUpperCase(),
        url: typeof url === "string" ? url : url.href,
        start: 0,
      });
      // 透传剩余可选参数（async / user / password）
      return (originalOpen as (...a: unknown[]) => void).apply(this, [
        method,
        url,
        ...rest,
      ]);
    };

    proto.send = function patchedSend(
      this: XMLHttpRequest,
      ...args: Parameters<XMLHttpRequest["send"]>
    ): void {
      const ctx = meta.get(this);
      if (ctx) {
        ctx.start = performance.now();

        const report = (type: string, extra: Record<string, unknown>): void => {
          emit(type, {
            method: ctx.method,
            url: ctx.url,
            duration: performance.now() - ctx.start,
            ...extra,
          });
          meta.delete(this);
        };

        // 拿到响应即完成（含 4xx/5xx），与 fetch resolve 语义一致
        this.addEventListener("load", () => {
          report("http", {
            status: this.status,
            ok: this.status >= 200 && this.status < 300,
          });
        });
        // 网络层失败：error / timeout / abort，此时 status 恒为 0
        this.addEventListener("error", () =>
          report("http_error", { error: "network error" }),
        );
        this.addEventListener("timeout", () =>
          report("http_error", { error: "timeout" }),
        );
        this.addEventListener("abort", () =>
          report("http_error", { error: "abort" }),
        );
      }
      return originalSend.apply(this, args);
    };

    // 还原被包裹的原型方法，避免重复打补丁
    this.onCleanup(() => {
      proto.open = originalOpen;
      proto.send = originalSend;
    });
  }
}
