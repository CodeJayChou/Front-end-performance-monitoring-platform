import { BaseIntegration } from "@monitor/sdk-core";
import { onCLS } from "web-vitals";
import { toPerformancePayload } from "./webVitals";

/**
 * Collect Cumulative Layout Shift with the reference session-window
 * algorithm. A simple sum of every layout-shift entry is not CLS and can
 * over-count unrelated shifts separated by long idle periods.
 */
export class CLSIntegration extends BaseIntegration {
  name = "CLS";

  protected install(): void {
    let active = true;
    onCLS((metric) => {
      if (!active) return;
      this.emit("performance", toPerformancePayload("CLS", metric.value));
    });

    this.onCleanup(() => {
      active = false;
    });
  }
}
