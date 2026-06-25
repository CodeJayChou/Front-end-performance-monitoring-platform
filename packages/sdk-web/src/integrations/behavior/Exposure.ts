import type { Client, Integration } from "@monitor/sdk-core";
import type { ExposurePayload } from "@monitor/event-contract";
import { createEvent } from "@monitor/event-contract";
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
export class ExposureIntegration implements Integration {
  name = "Exposure";

  private client?: Client;
  private observer?: IntersectionObserver;
  private readonly selector: string;
  private readonly threshold: number;
  private readonly seen = new WeakSet<Element>();

  constructor(options: ExposureOptions = {}) {
    this.selector = options.selector ?? "[data-track-exposure]";
    this.threshold = options.threshold ?? 0.5;
  }

  setup(client: Client): void {
    // 非浏览器环境，或运行时无 IntersectionObserver 时安全降级
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    this.client = client;
    this.observer = new IntersectionObserver(this.onIntersect, {
      threshold: this.threshold,
    });
    document
      .querySelectorAll(this.selector)
      .forEach((el) => this.observer?.observe(el));
  }

  /** 断开观测，避免持有已卸载节点导致泄漏。 */
  teardown(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private readonly onIntersect = (
    entries: IntersectionObserverEntry[],
  ): void => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      if (this.seen.has(el)) continue; // 只报首次曝光
      this.seen.add(el);

      const payload: ExposurePayload = {
        action: "exposure",
        tagName: el.tagName,
        xpath: getXPath(el),
        ratio: entry.intersectionRatio,
      };
      this.client?.capture(createEvent("behavior", payload));
    }
  };
}
