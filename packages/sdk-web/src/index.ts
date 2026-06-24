import { init, type SDKOptions } from "@monitor/sdk-core";
import { GlobalErrorIntegration } from "./integrations/error/GlobalError";

/**
 * Web SDK 初始化入口：默认装上 Web 内置插件，再透传用户配置。
 */
export function initWebSDK(options: SDKOptions = {}) {
  return init({
    platform: "web",
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });
}

export { GlobalErrorIntegration } from "./integrations/error/GlobalError";
