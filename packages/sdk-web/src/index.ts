import { init, type SDKOptions } from "@monitor/sdk-core";
import { GlobalErrorIntegration } from "./integrations/error/GlobalError";
import { PromiseRejectionIntegration } from "./integrations/error/PromiseRejection";
import { FetchIntegration } from "./integrations/network/Fetch";

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
      ...(options.integrations ?? []),
    ],
  });
}

export { GlobalErrorIntegration } from "./integrations/error/GlobalError";
export { PromiseRejectionIntegration } from "./integrations/error/PromiseRejection";
export { FetchIntegration } from "./integrations/network/Fetch";
