import { BaseIntegration } from "@monitor/sdk-core";
import { onINP } from "web-vitals";
import { toPerformancePayload } from "./webVitals";

const SNAPSHOT_INTERVAL_MS = 60_000;

/**
 * Collect Interaction to Next Paint using the reference web-vitals
 * implementation. Report changes while the page stays open so each observed
 * value can enter the processor's one-minute bucket. After the first user
 * interaction, also report the current page-session INP once per minute so a
 * long-lived page produces a continuous minute series. Page-hide still lets
 * web-vitals report the final value.
 */
export class INPIntegration extends BaseIntegration {
  name = "INP";

  protected install(): void {
    if (typeof document === "undefined") return;

    let latestValue: number | undefined;
    let snapshotTimer: ReturnType<typeof setInterval> | undefined;
    let active = true;

    onINP(
      (metric) => {
        if (!active) return;
        latestValue = metric.value;
        this.emit("performance", toPerformancePayload("INP", metric.value));

        if (snapshotTimer === undefined) {
          snapshotTimer = setInterval(() => {
            if (latestValue === undefined) return;
            this.emit("performance", toPerformancePayload("INP", latestValue));
          }, SNAPSHOT_INTERVAL_MS);
          // Do not keep Node-based SDK tests or command-line demos alive.
          (snapshotTimer as unknown as { unref?: () => void }).unref?.();
        }
      },
      { reportAllChanges: true, durationThreshold: 0 },
    );

    this.onCleanup(() => {
      active = false;
      if (snapshotTimer !== undefined) clearInterval(snapshotTimer);
    });
  }
}
