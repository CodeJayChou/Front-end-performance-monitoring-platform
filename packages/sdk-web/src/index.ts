import { init, type SDKOptions } from "@monitor/sdk-core";
import { GlobalErrorIntegration } from "./integrations/error/GlobalError";
import { PromiseRejectionIntegration } from "./integrations/error/PromiseRejection";
import { FetchIntegration } from "./integrations/network/Fetch";
import { ClickIntegration } from "./integrations/behavior/Click";
import { RouteIntegration } from "./integrations/behavior/Route";
import { ExposureIntegration } from "./integrations/behavior/Exposure";
import { FPIntegration } from "./integrations/performance/FP";
import { FCPIntegration } from "./integrations/performance/FCP";
import { LCPIntegration } from "./integrations/performance/LCP";
import { CLSIntegration } from "./integrations/performance/CLS";

/**
 * Web SDK 初始化入口：默认装上 Web 内置插件，再透传用户配置。
 */
export function initWebSDK(options: SDKOptions = {}) {
  return init({
    platform: "web",
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      new PromiseRejectionIntegration(),
      new FetchIntegration(),
      new ClickIntegration(),
      new RouteIntegration(),
      new ExposureIntegration(),
      new FPIntegration(),
      new FCPIntegration(),
      new LCPIntegration(),
      new CLSIntegration(),
      ...(options.integrations ?? []),
    ],
  });
}

export { GlobalErrorIntegration } from "./integrations/error/GlobalError";
export { PromiseRejectionIntegration } from "./integrations/error/PromiseRejection";
export { FetchIntegration } from "./integrations/network/Fetch";
export { ClickIntegration } from "./integrations/behavior/Click";
export { RouteIntegration } from "./integrations/behavior/Route";
export {
  ExposureIntegration,
  type ExposureOptions,
} from "./integrations/behavior/Exposure";
export { getXPath, getText } from "./integrations/behavior/dom";
export { FPIntegration } from "./integrations/performance/FP";
export { FCPIntegration } from "./integrations/performance/FCP";
export { LCPIntegration } from "./integrations/performance/LCP";
export { CLSIntegration } from "./integrations/performance/CLS";
export {
  rateMetric,
  toPerformancePayload,
  VITALS_THRESHOLDS,
} from "./integrations/performance/webVitals";
