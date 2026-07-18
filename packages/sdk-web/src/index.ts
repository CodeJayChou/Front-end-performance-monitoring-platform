import { init, type SDKOptions } from "@monitor/sdk-core";
import { parseWebStack } from "./stack/parseWebStack";
import { GlobalErrorIntegration } from "./integrations/error/GlobalError";
import { PromiseRejectionIntegration } from "./integrations/error/PromiseRejection";
import { ResourceErrorIntegration } from "./integrations/error/ResourceError";
import { FetchIntegration } from "./integrations/network/Fetch";
import { XHRIntegration } from "./integrations/network/XHR";
import { ClickIntegration } from "./integrations/behavior/Click";
import { RouteIntegration } from "./integrations/behavior/Route";
import { ExposureIntegration } from "./integrations/behavior/Exposure";
import { FPIntegration } from "./integrations/performance/FP";
import { FCPIntegration } from "./integrations/performance/FCP";
import { LCPIntegration } from "./integrations/performance/LCP";
import { CLSIntegration } from "./integrations/performance/CLS";
import { LongTaskIntegration } from "./integrations/performance/LongTask";
import { FlushOnPageHideIntegration } from "./integrations/lifecycle/FlushOnPageHide";

/**
 * Web SDK 初始化入口：默认装上 Web 内置插件，再透传用户配置。
 */
export function initWebSDK(options: SDKOptions = {}) {
  return init({
    platform: "web",
    ...options,
    sdk: options.sdk ?? { name: "@monitor/sdk-web", version: "0.0.0" },
    sessionId:
      options.sessionId ??
      getOrCreateWebSessionId(options.runtime ? () => options.runtime!.uuid() : undefined),
    // 默认注入 Web 栈解析器（置于 spread 之后，用户可通过 options.stackParser 覆盖）
    stackParser: options.stackParser ?? parseWebStack,
    integrations: [
      new GlobalErrorIntegration(),
      new PromiseRejectionIntegration(),
      new ResourceErrorIntegration(),
      new FetchIntegration({ ignoreUrls: options.dsn ? [options.dsn] : [] }),
      new XHRIntegration({ ignoreUrls: options.dsn ? [options.dsn] : [] }),
      new ClickIntegration(),
      new RouteIntegration(),
      new ExposureIntegration(),
      new FPIntegration(),
      new FCPIntegration(),
      new LCPIntegration(),
      new CLSIntegration(),
      new LongTaskIntegration(),
      new FlushOnPageHideIntegration(),
      ...(options.integrations ?? []),
    ],
  });
}

const SESSION_KEY = "__monitor_session_id__";

/** 同一浏览器标签页刷新后复用 session；Storage 不可用时安全降级到内存 UUID。 */
function getOrCreateWebSessionId(uuid?: () => string): string {
  const create = (): string =>
    uuid?.() ?? globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  if (typeof window === "undefined") return create();
  try {
    const storage = (window as unknown as { sessionStorage?: Storage }).sessionStorage;
    const current = storage?.getItem(SESSION_KEY);
    if (current) return current;
    const next = create();
    storage?.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return create();
  }
}

export { GlobalErrorIntegration } from "./integrations/error/GlobalError";
export { PromiseRejectionIntegration } from "./integrations/error/PromiseRejection";
export { ResourceErrorIntegration } from "./integrations/error/ResourceError";
export type { WebResourceErrorPayload } from "./types";
export { FetchIntegration, type FetchOptions } from "./integrations/network/Fetch";
export { XHRIntegration, type XHROptions } from "./integrations/network/XHR";
export { ClickIntegration } from "./integrations/behavior/Click";
export { RouteIntegration } from "./integrations/behavior/Route";
export {
  ExposureIntegration,
  type ExposureOptions,
} from "./integrations/behavior/Exposure";
export { getXPath, getText } from "./integrations/behavior/dom";
export { parseWebStack } from "./stack/parseWebStack";
export { FPIntegration } from "./integrations/performance/FP";
export { FCPIntegration } from "./integrations/performance/FCP";
export { LCPIntegration } from "./integrations/performance/LCP";
export { CLSIntegration } from "./integrations/performance/CLS";
export { LongTaskIntegration } from "./integrations/performance/LongTask";
export { FlushOnPageHideIntegration } from "./integrations/lifecycle/FlushOnPageHide";
export {
  rateMetric,
  toPerformancePayload,
  VITALS_THRESHOLDS,
} from "./integrations/performance/webVitals";
