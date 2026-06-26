import { BaseIntegration } from "@monitor/sdk-core";
import { observeEntries, toPerformancePayload } from "./webVitals";

/**
 * 首次内容绘制（First Contentful Paint）采集：
 * 监听 paint entry 的 "first-contentful-paint"，上报一次。
 */
export class FCPIntegration extends BaseIntegration {
  name = "FCP";

  private reported = false;

  protected install(): void {
    this.onCleanup(
      observeEntries("paint", (entries) => {
        for (const entry of entries) {
          if (this.reported || entry.name !== "first-contentful-paint") continue;
          this.reported = true;
          this.emit("performance", toPerformancePayload("FCP", entry.startTime));
        }
      }),
    );
  }
}
