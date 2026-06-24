import type { Middleware } from "./MiddlewarePipeline";

/**
 * contextMiddleware —— 运行时上下文增强示例 middleware。
 *
 * 把当前页面的 url / userAgent 注入事件 context（事件自带字段优先级更高）。
 * 仅在浏览器环境生效，SSR / Node 下安全降级。属于“可选增强”，由用户按需
 * client.addMiddleware(contextMiddleware) 接入。
 */
export const contextMiddleware: Middleware = {
  name: "context",

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
