import { BaseIntegration } from "@monitor/sdk-core";
import { onLCP } from "web-vitals";
import { toPerformancePayload } from "./webVitals";

/**
 * Collect the final Largest Contentful Paint using web-vitals. The reference
 * implementation drains pending PerformanceObserver entries when the page is
 * hidden, which avoids losing a delayed hero rendered shortly before unload.
 */
export class LCPIntegration extends BaseIntegration {
  name = "LCP";

  protected install(): void {
    if (typeof document === "undefined") return;

    let active = true;
    onLCP((metric) => {
      if (!active) return;
      this.emit("performance", toPerformancePayload("LCP", metric.value));
    });

    this.onCleanup(() => {
      active = false;
    });
  }
}
