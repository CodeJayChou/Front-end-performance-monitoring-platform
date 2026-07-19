import { BaseIntegration, type Client } from "@monitor/sdk-core";

/** 页面进入后台/卸载时刷新批量出口，避免等待定时器造成尾部事件丢失。 */
export class FlushOnPageHideIntegration extends BaseIntegration {
  name = "FlushOnPageHide";

  protected install(client: Client): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const flush = (): void => {
      void client.flush();
    };
    const flushWhenHidden = (): void => {
      if (document.visibilityState === "hidden") flush();
    };
    // Web Vitals finalize on visibilitychange. Flush there as well as on
    // pagehide so the final LCP/CLS/INP event is not left in the batch queue
    // during a navigation or tab close.
    document.addEventListener("visibilitychange", flushWhenHidden, true);
    window.addEventListener("pagehide", flush, true);
    this.onCleanup(() => {
      document.removeEventListener("visibilitychange", flushWhenHidden, true);
      window.removeEventListener("pagehide", flush, true);
    });
  }
}
