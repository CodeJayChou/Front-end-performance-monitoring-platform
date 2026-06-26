import { BaseIntegration } from "@monitor/sdk-core";
import { observeEntries, toPerformancePayload } from "./webVitals";

/**
 * 首次绘制（First Paint）采集：监听 paint entry 的 "first-paint"，上报一次。
 */
export class FPIntegration extends BaseIntegration {
  name = "FP";

  private reported = false;

  protected install(): void {
    this.onCleanup(
      observeEntries("paint", (entries) => {
        for (const entry of entries) {
          if (this.reported || entry.name !== "first-paint") continue;
          this.reported = true;
          this.emit("performance", toPerformancePayload("FP", entry.startTime));
        }
      }),
    );
  }
}
