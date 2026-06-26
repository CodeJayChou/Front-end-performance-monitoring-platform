import { BaseIntegration } from "@monitor/sdk-core";
import { observeEntries, onPageHidden, toPerformancePayload } from "./webVitals";

/**
 * 最大内容绘制（Largest Contentful Paint）采集。
 *
 * LCP 会随渲染持续刷新，浏览器按时间顺序派发候选项，最后一条即最终值。
 * 因此累积取最后一次 startTime，在页面首次隐藏（visibilitychange → hidden）时定稿上报一次。
 */
export class LCPIntegration extends BaseIntegration {
  name = "LCP";

  private value = 0;
  private finalized = false;

  protected install(): void {
    this.onCleanup(
      observeEntries("largest-contentful-paint", (entries) => {
        for (const entry of entries) this.value = entry.startTime;
      }),
    );

    this.onCleanup(
      onPageHidden(() => {
        if (this.finalized || this.value <= 0) return;
        this.finalized = true;
        this.emit("performance", toPerformancePayload("LCP", this.value));
      }),
    );
  }
}
