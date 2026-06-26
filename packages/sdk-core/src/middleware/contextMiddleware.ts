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
 * 跨端 key 一致性（关键）：只在取到值时才写 key——RN/SSR 等无 location/navigator 的
 * 环境不会被塞进 `url: undefined`、`userAgent: undefined`，避免「字段乱」导致后端
 * 聚合时 undefined 与缺失不一致。这就是把「跨端 context 归一」落到一处的做法。
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
      const env: Record<string, unknown> = {};

      const url = g.location?.href;
      if (url !== undefined) env.url = url;
      const userAgent = g.navigator?.userAgent;
      if (userAgent !== undefined) env.userAgent = userAgent;

      // 事件自带 context 优先级更高，覆盖环境兜底维度。
      event.context = { ...env, ...event.context };

      return next(event);
    },
  };
}

/** 默认实例（web 平台）；保留具名导出以兼容既有 import。 */
export const contextMiddleware: Middleware = createContextMiddleware();
