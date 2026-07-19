import type { BaseEvent } from "@monitor/event-contract";
import type { Middleware } from "./MiddlewarePipeline";
import { MiddlewareType } from "./MiddlewarePipeline";

export interface PrivacyOptions {
  /** 默认不采集 click/text 等可识别文本。 */
  captureText?: boolean;
  /** 默认只保留这些 user 字段；空数组表示移除 user。 */
  allowedUserFields?: string[];
  /** URL 默认去掉 query/hash；指定后仅保留 allowlist 参数。 */
  allowedUrlParams?: string[];
  /** 防止上下文无限增长。 */
  maxBreadcrumbs?: number;
  /** 单个字符串最大长度。 */
  maxStringLength?: number;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "client_secret",
]);

/**
 * 轻量、异常安全的隐私清洗 middleware。
 * 它只创建新对象，不修改 Integration 传入的 payload，便于业务继续复用原始对象。
 */
export function sanitizeEvent(
  event: BaseEvent,
  options: PrivacyOptions = {},
): BaseEvent {
  const maxStringLength = options.maxStringLength ?? 2_000;
  const clean = (value: unknown, key?: string, seen = new WeakSet<object>()): unknown => {
    const normalizedKey = key?.toLowerCase();
    if (normalizedKey && SENSITIVE_KEYS.has(normalizedKey)) return undefined;
    if (
      !options.captureText &&
      (normalizedKey === "text" || (normalizedKey === "value" && typeof value === "string"))
    ) {
      return undefined;
    }
    if (typeof value === "string") {
      if (normalizedKey === "url" || normalizedKey === "href" || normalizedKey === "pageurl") {
        return sanitizeUrl(value, options.allowedUrlParams);
      }
      return value.slice(0, maxStringLength);
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    if (value === undefined) return undefined;
    if (typeof value !== "object") return String(value).slice(0, maxStringLength);
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    if (Array.isArray(value)) {
      return value
        .slice(0, options.maxBreadcrumbs ?? 50)
        .map((item) => clean(item, undefined, seen))
        .filter((item) => item !== undefined);
    }

    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const next = clean(childValue, childKey, seen);
      if (next !== undefined) output[childKey] = next;
    }
    return output;
  };

  const context = clean(event.context) as Record<string, unknown>;
  if (typeof context.url === "string") {
    context.url = sanitizeUrl(context.url, options.allowedUrlParams);
  }
  if (context.user && typeof context.user === "object") {
    const allowed = new Set(options.allowedUserFields ?? ["id"]);
    context.user = Object.fromEntries(
      Object.entries(context.user).filter(([key]) => allowed.has(key)),
    );
  }
  if (Array.isArray(context.breadcrumbs)) {
    context.breadcrumbs = context.breadcrumbs.slice(-(options.maxBreadcrumbs ?? 50));
  }

  const payload = clean(event.payload);
  return { ...event, context, payload };
}

export function sanitizeUrl(url: string, allowedParams: string[] = []): string {
  try {
    const parsed = new URL(url);
    if (allowedParams.length === 0) {
      parsed.search = "";
    } else {
      const allowed = new Set(allowedParams);
      for (const key of [...parsed.searchParams.keys()]) {
        if (!allowed.has(key)) parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split(/[?#]/, 1)[0] ?? url;
  }
}

export function createPrivacyMiddleware(options: PrivacyOptions = {}): Middleware {
  return {
    name: "privacy",
    // 在 context middleware 后执行，确保运行时注入的 URL/userAgent 也被清洗。
    type: MiddlewareType.CONTEXTUAL,
    priority: -10,
    handle: (event, next) => next(sanitizeEvent(event, options)),
  };
}
