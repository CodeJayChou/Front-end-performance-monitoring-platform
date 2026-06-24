import type { Middleware } from "./MiddlewarePipeline";
import { MiddlewareType } from "./MiddlewarePipeline";

/**
 * contextMiddleware —— 运行时上下文增强（CONTEXTUAL 阶段默认成员）。
 *
 * 把当前页面的 url / userAgent 注入事件 context（事件自带字段优先级更高）。
 * 仅在浏览器环境生效，SSR / Node 下安全降级。
 *
 * 注意：这里只注入“运行时环境维度”。业务上下文（user / tags / route /
 * breadcrumbs）由 Scope 在进入 pipeline 前注入，不在 middleware 内做 scope merge。
 */
export const contextMiddleware: Middleware = {
  name: "context",
  type: MiddlewareType.CONTEXTUAL,

  handle(event, next) {
    const runtime = globalThis as {
      location?: { href?: string };
      navigator?: { userAgent?: string };
    };

    event.context = {
      url: runtime.location?.href,
      userAgent: runtime.navigator?.userAgent,
      ...event.context,
    };

    return next(event);
  },
};
