import type { Middleware } from "./MiddlewarePipeline";
import { MiddlewareType } from "./MiddlewarePipeline";
import type { RuntimePlatform } from "../platform/RuntimePlatform";
import { webPlatform } from "../platform/RuntimePlatform";

/**
 * contextMiddleware —— 运行时上下文增强（CONTEXTUAL 阶段默认成员）。
 *
 * 把当前页面的 url / userAgent 注入事件 context（事件自带字段优先级更高）。
 * 运行时维度从注入的 `RuntimePlatform.global` 读取，不再直接摸 `globalThis`，
 * 因此小程序 / RN 只需提供各自的 global 实现即可复用本逻辑；缺失时安全降级。
 *
 * 注意：这里只注入“运行时环境维度”。业务上下文（user / tags / route /
 * breadcrumbs）由 Scope 在进入 pipeline 前注入，不在 middleware 内做 scope merge。
 */
export function createContextMiddleware(
  runtime: RuntimePlatform = webPlatform,
): Middleware {
  return {
    name: "context",
    type: MiddlewareType.CONTEXTUAL,

    handle(event, next) {
      const g = runtime.global;

      event.context = {
        url: g.location?.href,
        userAgent: g.navigator?.userAgent,
        ...event.context,
      };

      return next(event);
    },
  };
}

/** 默认实例（web 平台）；保留具名导出以兼容既有 import。 */
export const contextMiddleware: Middleware = createContextMiddleware();
