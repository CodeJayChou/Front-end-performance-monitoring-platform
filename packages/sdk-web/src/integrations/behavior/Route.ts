import type { Client, Integration } from "@monitor/sdk-core";
import type { RouteChangePayload } from "@monitor/event-contract";
import { createEvent } from "@monitor/event-contract";

/**
 * SPA 路由变化采集：覆盖 history（pushState/replaceState/popstate）与 hash 两种模式。
 *
 * history.pushState / replaceState 不触发任何原生事件，必须 patch 才能感知。
 * patch 会被 teardown 完整还原，避免 SPA 卸载 / 重复 setup 时叠加补丁与内存泄漏。
 */
export class RouteIntegration implements Integration {
  name = "Route";

  private client?: Client;
  private lastUrl = "";
  private originalPushState?: History["pushState"];
  private originalReplaceState?: History["replaceState"];

  private readonly onPopState = (): void => this.emit("history");
  private readonly onHashChange = (): void => this.emit("hash");

  setup(client: Client): void {
    // 非浏览器环境（SSR / Node）安全降级
    if (typeof window === "undefined" || typeof history === "undefined") return;

    this.client = client;
    this.lastUrl = location.href;

    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    const originalPush = this.originalPushState;
    const originalReplace = this.originalReplaceState;
    const emit = (): void => this.emit("history");

    history.pushState = function patchedPushState(
      this: History,
      ...args: Parameters<History["pushState"]>
    ): void {
      originalPush.apply(this, args);
      emit();
    };
    history.replaceState = function patchedReplaceState(
      this: History,
      ...args: Parameters<History["replaceState"]>
    ): void {
      originalReplace.apply(this, args);
      emit();
    };

    window.addEventListener("popstate", this.onPopState);
    window.addEventListener("hashchange", this.onHashChange);
  }

  /** 还原被 patch 的 history 方法并解绑监听。 */
  teardown(): void {
    if (typeof window === "undefined") return;
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = undefined;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = undefined;
    }
    window.removeEventListener("popstate", this.onPopState);
    window.removeEventListener("hashchange", this.onHashChange);
  }

  private emit(mode: "hash" | "history"): void {
    const to = location.href;
    // replaceState 同址 / 重复触发：URL 未变则不上报
    if (to === this.lastUrl) return;

    const from = this.lastUrl;
    this.lastUrl = to;

    const payload: RouteChangePayload = {
      action: "route_change",
      from,
      to,
      mode,
    };
    this.client?.capture(createEvent("behavior", payload));
  }
}
