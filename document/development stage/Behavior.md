> ⛔ **已废弃（DEPRECATED）—— 不要按本文实现。**
> 本文是早期草案，与当前架构系统性冲突（自造 `CorePipeline` / `BehaviorLayer` 巨类、
> 在事件上加 `data`/`url`/`sdkVersion` 平级字段、用 `destroy` 自管生命周期）。
>
> 权威架构见 [`document/ARCHITECTURE.md`](../ARCHITECTURE.md)。
> 行为采集的**实际实现**：`packages/sdk-web/src/integrations/behavior/`
> （`Click.ts` / `Route.ts` / `Exposure.ts`，各自一个 `Integration`），
> payload 契约见 `packages/event-contract/src/event/BehaviorEvent.ts`。
>
> 保留本文仅为记录设计演进，请勿据此提改动或生成代码。
>
> ---

1. Event Contract（行为事件定义）
// packages/types/src/event-contract.ts

export type EventType =
  | "click"
  | "input"
  | "route_change"
  | "scroll"
  | "visibility_change";

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: number;
  url: string;
  sdkVersion: string;
}

export interface ClickEvent extends BaseEvent {
  type: "click";
  data: {
    tagName: string;
    xpath: string;
    text?: string;
  };
}

export interface InputEvent extends BaseEvent {
  type: "input";
  data: {
    tagName: string;
    name?: string;
    valueLength: number;
  };
}

export interface RouteChangeEvent extends BaseEvent {
  type: "route_change";
  data: {
    from: string;
    to: string;
    mode: "hash" | "history";
  };
}

export type BehaviorEvent = ClickEvent | InputEvent | RouteChangeEvent;
2. SDK Core 接口（Behavior Layer 只依赖它）
// sdk-core/contracts.ts

import { BehaviorEvent } from "@monitor/types";

export interface CorePipeline {
  process(event: BehaviorEvent): void;
}
3. DOM 工具（用于提取 xpath / 元信息）
// behavior/utils/dom.ts

export function getXPath(el: HTMLElement): string {
  if (!el) return "";

  const segments: string[] = [];

  while (el && el.nodeType === 1) {
    let index = 1;
    let sibling = el.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === el.tagName) index++;
      sibling = sibling.previousElementSibling;
    }

    segments.unshift(`${el.tagName.toLowerCase()}[${index}]`);
    el = el.parentElement as HTMLElement;
  }

  return "/" + segments.join("/");
}

export function getText(el: HTMLElement): string | undefined {
  const text = el?.textContent?.trim();
  return text ? text.slice(0, 50) : undefined;
}
4. Behavior Layer 核心实现（重点）
// behavior/BehaviorLayer.ts

import { CorePipeline } from "../sdk-core/contracts";
import { BehaviorEvent } from "@monitor/types";
import { getXPath, getText } from "./utils/dom";

export interface BehaviorLayerOptions {
  sdkVersion: string;
  core: CorePipeline;
  enableClick?: boolean;
  enableInput?: boolean;
  enableRoute?: boolean;
}

export class BehaviorLayer {
  private core: CorePipeline;
  private sdkVersion: string;

  private clickHandler?: (e: MouseEvent) => void;
  private inputHandler?: (e: Event) => void;
  private popStateHandler?: () => void;

  constructor(options: BehaviorLayerOptions) {
    this.core = options.core;
    this.sdkVersion = options.sdkVersion;

    if (options.enableClick !== false) this.initClick();
    if (options.enableInput !== false) this.initInput();
    if (options.enableRoute !== false) this.initRoute();
  }

  private emit(event: BehaviorEvent) {
    this.core.process(event);
  }

  // -------------------------
  // Click Behavior
  // -------------------------
  private initClick() {
    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      this.emit({
        id: crypto.randomUUID(),
        type: "click",
        timestamp: Date.now(),
        url: location.href,
        sdkVersion: this.sdkVersion,
        data: {
          tagName: target.tagName,
          xpath: getXPath(target),
          text: getText(target),
        },
      });
    };

    window.addEventListener("click", this.clickHandler, true);
  }

  // -------------------------
  // Input Behavior
  // -------------------------
  private initInput() {
    this.inputHandler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target || !target.tagName) return;

      this.emit({
        id: crypto.randomUUID(),
        type: "input",
        timestamp: Date.now(),
        url: location.href,
        sdkVersion: this.sdkVersion,
        data: {
          tagName: target.tagName,
          name: target.name,
          valueLength: target.value?.length || 0,
        },
      });
    };

    window.addEventListener("input", this.inputHandler, true);
  }

  // -------------------------
  // Route Change (SPA)
  // -------------------------
  private initRoute() {
    const wrapHistory = () => {
      const originalPush = history.pushState;
      const originalReplace = history.replaceState;

      const notify = () => this.handleRouteChange();

      history.pushState = (...args) => {
        originalPush.apply(history, args as any);
        notify();
      };

      history.replaceState = (...args) => {
        originalReplace.apply(history, args as any);
        notify();
      };

      window.addEventListener("popstate", notify);
    };

    wrapHistory();
  }

  private lastUrl = location.href;

  private handleRouteChange() {
    const newUrl = location.href;

    const event: BehaviorEvent = {
      id: crypto.randomUUID(),
      type: "route_change",
      timestamp: Date.now(),
      url: newUrl,
      sdkVersion: this.sdkVersion,
      data: {
        from: this.lastUrl,
        to: newUrl,
        mode: "history",
      },
    };

    this.lastUrl = newUrl;
    this.emit(event);
  }

  // -------------------------
  // destroy（必须支持可卸载）
  // -------------------------
  public destroy() {
    if (this.clickHandler) {
      window.removeEventListener("click", this.clickHandler, true);
    }

    if (this.inputHandler) {
      window.removeEventListener("input", this.inputHandler, true);
    }

    if (this.popStateHandler) {
      window.removeEventListener("popstate", this.popStateHandler);
    }
  }
}
5. SDK 初始化集成方式（标准入口）
// sdk/init.ts

import { BehaviorLayer } from "../behavior/BehaviorLayer";
import { Core } from "../core/Core";

export function initSDK() {
  const core = new Core();

  const behavior = new BehaviorLayer({
    sdkVersion: "1.0.0",
    core,
    enableClick: true,
    enableInput: true,
    enableRoute: true,
  });

  return {
    core,
    behavior,
  };
}
6. Core 示例（用于闭环验证）
// core/Core.ts

import { CorePipeline } from "./contracts";
import { BehaviorEvent } from "@monitor/types";

export class Core implements CorePipeline {
  process(event: BehaviorEvent): void {
    // 这里才做：
    // normalize → enrich → filter → sampling → dispatch

    console.log("[CORE EVENT]", event);
  }
}