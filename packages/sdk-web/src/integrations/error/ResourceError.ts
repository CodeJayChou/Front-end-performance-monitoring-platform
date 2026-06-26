import { BaseIntegration } from "@monitor/sdk-core";
import type { ResourceType } from "@monitor/event-contract";
import type { WebResourceErrorPayload } from "../../types";
import { getXPath } from "../behavior/dom";

/** 会在 window 'error' 上报告资源加载失败的元素标签（小写）。 */
const RESOURCE_TAGS = new Set([
  "script",
  "img",
  "link",
  "video",
  "audio",
  "source",
]);

/**
 * 资源加载错误采集。
 *
 * 资源（script/img/link/video/audio…）加载失败的 error 事件**不冒泡、也不触发
 * window.onerror**，只能在捕获阶段通过 `addEventListener('error', …, true)` 拿到。
 * 因此这里独立于 GlobalError（后者走 window.onerror，只负责 JS 运行时错误），两者不重叠。
 *
 * 上报 `type:"error"` + `kind:"resource"`，与 JS 运行时错误（kind:"js"）/ Promise
 * 拒绝（kind:"promise"）同挂在统一的 error 事件下，由 `kind` 判别。
 *
 * 职责仅限 instrumentation：把浏览器的 error 事件 → WebResourceErrorPayload 原始信号
 * （跨平台核心 + web 定位扩展），不做 Resource Timing 对齐 / 失败原因推断（属 pipeline
 * enrich 阶段）。
 */
export class ResourceErrorIntegration extends BaseIntegration {
  name = "ResourceError";

  protected install(): void {
    const handler = (event: Event): void => {
      const target = event.target as
        | (HTMLElement & { src?: string; href?: string })
        | null;
      // JS 运行时错误的 target 是 window（无 tagName），在此被过滤，交给 GlobalError。
      const tagName = target?.tagName?.toLowerCase();
      if (!target || !tagName || !RESOURCE_TAGS.has(tagName)) return;

      const url = extractResourceUrl(target, tagName);

      this.emit<WebResourceErrorPayload>("error", {
        kind: "resource",
        url,
        tagName,
        resourceType: normalizeResourceType(tagName, target),
        message: `Resource load failed: ${tagName}`,
        isCrossOrigin: isCrossOriginUrl(url),
        domPath: extractDomPath(target),
        xpath: getXPath(target),
        pageUrl: location.href,
      });
    };

    // capture 阶段必须开启，否则收不到资源加载错误。
    window.addEventListener("error", handler, true);
    this.onCleanup(() => window.removeEventListener("error", handler, true));
  }
}

/** 按 tagName 取资源 URL，避免 instanceof（SSR/测试环境无 DOM 构造器）。 */
function extractResourceUrl(
  target: HTMLElement & { src?: string; href?: string },
  tagName: string,
): string {
  const raw =
    tagName === "link"
      ? (target.href ?? target.getAttribute?.("href"))
      : (target.src ?? target.getAttribute?.("src"));
  return raw ?? "";
}

/** tagName → 归一资源种类；link 再按 rel/as 细分 css / font。 */
function normalizeResourceType(
  tagName: string,
  target: HTMLElement,
): ResourceType {
  switch (tagName) {
    case "script":
      return "script";
    case "img":
      return "img";
    case "video":
    case "audio":
    case "source":
      return "media";
    case "link": {
      const rel = target.getAttribute?.("rel")?.toLowerCase() ?? "";
      const as = target.getAttribute?.("as")?.toLowerCase() ?? "";
      if (as === "font") return "font";
      if (rel.includes("stylesheet")) return "css";
      return "other";
    }
    default:
      return "other";
  }
}

/**
 * 是否跨域资源：相对 location 解析后比对 origin。
 * URL 取不到 / 解析失败时按同源处理（不误判为跨域）。
 */
function isCrossOriginUrl(url: string): boolean {
  if (!url) return false;
  try {
    return new URL(url, location.href).origin !== location.origin;
  } catch {
    return false;
  }
}

/**
 * 生成元素的 CSS 选择器路径（关键定位字段），形如 `div#app > img.logo`。
 * 命中带 id 的祖先即截断（id 已足够唯一）；className 为非字符串（SVG）时跳过。
 */
function extractDomPath(node: HTMLElement): string {
  const path: string[] = [];
  let el: HTMLElement | null = node;

  while (el && el.nodeType === 1) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      path.unshift(`${selector}#${el.id}`);
      break;
    }
    if (typeof el.className === "string" && el.className.trim()) {
      selector += `.${el.className.trim().split(/\s+/).join(".")}`;
    }
    path.unshift(selector);
    el = el.parentElement;
  }

  return path.join(" > ");
}
