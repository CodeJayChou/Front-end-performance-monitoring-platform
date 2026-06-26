import { BaseIntegration } from "@monitor/sdk-core";
import type { RouteChangePayload } from "@monitor/event-contract";

/**
 * SPA 路由变化采集：覆盖 history（pushState/replaceState/popstate）与 hash 两种模式。
 *
 * history.pushState / replaceState 不触发任何原生事件，必须 patch 才能感知。
 * patch 会被 teardown 完整还原，避免 SPA 卸载 / 重复 setup 时叠加补丁与内存泄漏。
 */
export class RouteIntegration extends BaseIntegration {
  name = "Route";

  private lastUrl = "";

  private readonly onPopState = (): void => this.report("history");
  private readonly onHashChange = (): void => this.report("hash");

  /** 需要 history（patch）与 location（取 href），缺任一即安全降级。 */
  protected isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof history !== "undefined" &&
      typeof location !== "undefined"
    );
  }

  protected install(): void {
    this.lastUrl = location.href;

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const report = (): void => this.report("history");

    history.pushState = function patchedPushState(
      this: History,
      ...args: Parameters<History["pushState"]>
    ): void {
      originalPush.apply(this, args);
      report();
    };
    history.replaceState = function patchedReplaceState(
      this: History,
      ...args: Parameters<History["replaceState"]>
    ): void {
      originalReplace.apply(this, args);
      report();
    };
    // 还原被 patch 的 history 方法
    this.onCleanup(() => {
      history.pushState = originalPush;
      history.replaceState = originalReplace;
    });

    window.addEventListener("popstate", this.onPopState);
    window.addEventListener("hashchange", this.onHashChange);
    this.onCleanup(() => {
      window.removeEventListener("popstate", this.onPopState);
      window.removeEventListener("hashchange", this.onHashChange);
    });
  }

  private report(mode: "hash" | "history"): void {
    const to = location.href;
    // replaceState 同址 / 重复触发：URL 未变则不上报
    if (to === this.lastUrl) return;

    const from = this.lastUrl;
    this.lastUrl = to;

    this.emit<RouteChangePayload>("behavior", {
      action: "route_change",
      from,
      to,
      mode,
    });
  }
}
