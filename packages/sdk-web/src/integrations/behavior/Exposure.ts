import { BaseIntegration } from "@monitor/sdk-core";
import type { ExposurePayload } from "@monitor/event-contract";
import { getXPath } from "./dom";

export interface ExposureOptions {
  /** 需要监听曝光的元素选择器，默认 `[data-track-exposure]` */
  selector?: string;
  /** 进入视口的可见比例阈值（0~1），默认 0.5 */
  threshold?: number;
}

/**
 * 元素曝光采集：基于 IntersectionObserver，元素首次进入视口时上报一次。
 *
 * 只观测显式打了选择器标记的元素（默认 `[data-track-exposure]`），
 * 避免全量观测带来的性能与噪音；用 WeakSet 去重，保证“首次曝光只报一次”。
 */
export class ExposureIntegration extends BaseIntegration {
  name = "Exposure";

  private readonly selector: string;
  private readonly threshold: number;
  private readonly seen = new WeakSet<Element>();

  constructor(options: ExposureOptions = {}) {
    super();
    this.selector = options.selector ?? "[data-track-exposure]";
    this.threshold = options.threshold ?? 0.5;
  }

  /** 需要 document + IntersectionObserver，运行时缺任一即安全降级。 */
  protected isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      typeof IntersectionObserver !== "undefined"
    );
  }

  protected install(): void {
    const observer = new IntersectionObserver(this.onIntersect, {
      threshold: this.threshold,
    });
    document
      .querySelectorAll(this.selector)
      .forEach((el) => observer.observe(el));
    // 断开观测，避免持有已卸载节点导致泄漏
    this.onCleanup(() => observer.disconnect());
  }

  private readonly onIntersect = (
    entries: IntersectionObserverEntry[],
  ): void => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      if (this.seen.has(el)) continue; // 只报首次曝光
      this.seen.add(el);

      this.emit<ExposurePayload>("behavior", {
        action: "exposure",
        tagName: el.tagName,
        xpath: getXPath(el),
        ratio: entry.intersectionRatio,
      });
    }
  };
}
