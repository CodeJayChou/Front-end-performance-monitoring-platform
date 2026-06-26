import { BaseIntegration } from "@monitor/sdk-core";
import type { LongTaskPayload } from "@monitor/event-contract";
import { observeEntries, onPageHidden } from "./webVitals";

/** 单个 long task 的「阻塞」阈值：超过 50ms 的部分才计入总阻塞时长（对齐 TBT 定义）。 */
const BLOCKING_THRESHOLD = 50;

/**
 * 长任务（Long Task）采集。
 *
 * 监听 `longtask` entry（浏览器判定 >50ms 的主线程阻塞任务），会话内累加
 * 条数 / 总阻塞时长 / 最长单任务，在页面首次隐藏时定稿上报一条聚合事件。
 * 不逐条上报：单页可能产生几十上百个 long task，聚合既保留卡顿规模又避免噪量。
 */
export class LongTaskIntegration extends BaseIntegration {
  name = "LongTask";

  private count = 0;
  private totalBlockingTime = 0;
  private longest = 0;
  private firstStart = -1;
  private finalized = false;

  protected install(): void {
    this.onCleanup(
      observeEntries("longtask", (entries) => {
        for (const entry of entries) {
          this.count += 1;
          this.totalBlockingTime += Math.max(
            0,
            entry.duration - BLOCKING_THRESHOLD,
          );
          if (entry.duration > this.longest) this.longest = entry.duration;
          if (this.firstStart < 0) this.firstStart = entry.startTime;
        }
      }),
    );

    this.onCleanup(
      onPageHidden(() => {
        // 无 long task 则无需上报；finalized 保证只定稿一次
        if (this.finalized || this.count === 0) return;
        this.finalized = true;
        this.emit<LongTaskPayload>("performance", {
          metric: "LongTask",
          count: this.count,
          totalBlockingTime: this.totalBlockingTime,
          longest: this.longest,
          startTime: this.firstStart,
        });
      }),
    );
  }
}
