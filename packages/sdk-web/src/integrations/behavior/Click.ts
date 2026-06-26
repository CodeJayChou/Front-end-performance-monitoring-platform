import { BaseIntegration } from "@monitor/sdk-core";
import type { ClickPayload } from "@monitor/event-contract";
import { getXPath, getText } from "./dom";

/**
 * 点击行为采集：捕获阶段监听全局 click，把被点元素压成统一 behavior 事件。
 * 只采集原始信号交给 Core，不做 normalize / sampling。
 */
export class ClickIntegration extends BaseIntegration {
  name = "Click";

  private readonly onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    // 文本节点 / 非元素节点（nodeType !== 1）无法定位，直接忽略
    if (!target || target.nodeType !== 1) return;

    this.emit<ClickPayload>("behavior", {
      action: "click",
      tagName: target.tagName,
      xpath: getXPath(target),
      text: getText(target),
    });
  };

  protected install(): void {
    // 捕获阶段监听，避免被 stopPropagation 的业务处理器吞掉
    window.addEventListener("click", this.onClick, true);
    this.onCleanup(() =>
      window.removeEventListener("click", this.onClick, true),
    );
  }
}
