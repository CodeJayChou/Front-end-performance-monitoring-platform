import { BaseIntegration, type Client } from "@monitor/sdk-core";

/** 页面进入后台/卸载时刷新批量出口，避免等待定时器造成尾部事件丢失。 */
export class FlushOnPageHideIntegration extends BaseIntegration {
  name = "FlushOnPageHide";

  protected install(client: Client): void {
    const flush = (): void => {
      void client.flush();
    };
    window.addEventListener("pagehide", flush, true);
    this.onCleanup(() => window.removeEventListener("pagehide", flush, true));
  }
}
