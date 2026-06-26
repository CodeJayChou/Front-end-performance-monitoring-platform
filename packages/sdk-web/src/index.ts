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

/**
 * Web SDK 初始化入口：默认装上 Web 内置插件，再透传用户配置。
 */
export function initWebSDK(options: SDKOptions = {}) {
  return init({
    platform: "web",
    ...options,
    // 默认注入 Web 栈解析器（置于 spread 之后，用户可通过 options.stackParser 覆盖）
    stackParser: options.stackParser ?? parseWebStack,
    integrations: [
      new GlobalErrorIntegration(),
      new PromiseRejectionIntegration(),
      new ResourceErrorIntegration(),
      new FetchIntegration(),
      new XHRIntegration(),
      new ClickIntegration(),
      new RouteIntegration(),
      new ExposureIntegration(),
      new FPIntegration(),
      new FCPIntegration(),
      new LCPIntegration(),
      new CLSIntegration(),
      new LongTaskIntegration(),
      ...(options.integrations ?? []),
    ],
  });
}

export { GlobalErrorIntegration } from "./integrations/error/GlobalError";
export { PromiseRejectionIntegration } from "./integrations/error/PromiseRejection";
export { ResourceErrorIntegration } from "./integrations/error/ResourceError";
export type { WebResourceErrorPayload } from "./types";
export { FetchIntegration } from "./integrations/network/Fetch";
export { XHRIntegration } from "./integrations/network/XHR";
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
export {
  rateMetric,
  toPerformancePayload,
  VITALS_THRESHOLDS,
} from "./integrations/performance/webVitals";
