import { BaseIntegration } from "@monitor/sdk-core";
import { observeEntries, onPageHidden, toPerformancePayload } from "./webVitals";

/** layout-shift entry 的扩展字段（不在基础 PerformanceEntry 类型里）。 */
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

/**
 * 累积布局偏移（Cumulative Layout Shift）采集。
 *
 * 累加「非用户输入引起」的布局偏移分值（hadRecentInput=true 的偏移属正常交互，忽略），
 * 在页面首次隐藏时定稿上报一次。
 */
export class CLSIntegration extends BaseIntegration {
  name = "CLS";

  private value = 0;
  private finalized = false;

  protected install(): void {
    this.onCleanup(
      observeEntries("layout-shift", (entries) => {
        for (const entry of entries as LayoutShiftEntry[]) {
          if (!entry.hadRecentInput) this.value += entry.value;
        }
      }),
    );

    this.onCleanup(
      onPageHidden(() => {
        if (this.finalized) return;
        this.finalized = true;
        this.emit("performance", toPerformancePayload("CLS", this.value));
      }),
    );
  }
}
