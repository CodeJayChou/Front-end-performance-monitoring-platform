import { BaseIntegration } from "@monitor/sdk-core";
import { onFCP } from "web-vitals";
import { toPerformancePayload } from "./webVitals";

/**
 * Collect First Contentful Paint with the web-vitals reference lifecycle
 * handling, including buffered entries, prerender activation and BFCache.
 */
export class FCPIntegration extends BaseIntegration {
  name = "FCP";

  protected install(): void {
    let active = true;
    onFCP((metric) => {
      if (!active) return;
      this.emit("performance", toPerformancePayload("FCP", metric.value));
    });

    this.onCleanup(() => {
      active = false;
    });
  }
}
