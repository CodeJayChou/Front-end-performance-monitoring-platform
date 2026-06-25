import type { Client, Integration } from "@monitor/sdk-core";
import type { ClickPayload } from "@monitor/event-contract";
import { createEvent } from "@monitor/event-contract";
import { getXPath, getText } from "./dom";

/**
 * 点击行为采集：捕获阶段监听全局 click，把被点元素压成统一 behavior 事件。
 * 只采集原始信号交给 Core，不做 normalize / sampling。
 */
export class ClickIntegration implements Integration {
  name = "Click";

  private client?: Client;

  private readonly onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    // 文本节点 / 非元素节点（nodeType !== 1）无法定位，直接忽略
    if (!target || target.nodeType !== 1) return;

    const payload: ClickPayload = {
      action: "click",
      tagName: target.tagName,
      xpath: getXPath(target),
      text: getText(target),
    };
    this.client?.capture(createEvent("behavior", payload));
  };

  setup(client: Client): void {
    // 非浏览器环境（SSR / Node）安全降级
    if (typeof window === "undefined") return;
    this.client = client;
    // 捕获阶段监听，避免被 stopPropagation 的业务处理器吞掉
    window.addEventListener("click", this.onClick, true);
  }

  /** 卸载监听，避免重复注册 / 内存泄漏。 */
  teardown(): void {
    if (typeof window === "undefined") return;
    window.removeEventListener("click", this.onClick, true);
  }
}
