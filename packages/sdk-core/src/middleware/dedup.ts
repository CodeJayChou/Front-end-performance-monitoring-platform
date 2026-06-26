import type { BaseEvent, ErrorPayload, EventRuntime } from "@monitor/event-contract";
import { defaultRuntime } from "@monitor/event-contract";
import type { Middleware } from "./MiddlewarePipeline";
import { MiddlewareType } from "./MiddlewarePipeline";
import { BUILTIN_PRIORITY } from "./builtins";
import { fnv1a } from "../util/hash";

/**
 * DedupStore —— 指纹去重的存储抽象。时间由调用方注入（`now`），
 * store 自身不碰全局时钟，从而可被确定性测试驱动（配合注入的 runtime）。
 */
export interface DedupStore {
  /**
   * 在 `now` 时刻查询 key 是否仍处于去重窗口内。
   * 命中（仍在窗口内）返回 true 表示重复；未命中则以 `now+windowMs` 记录并返回 false。
   */
  seen(key: string, now: number, windowMs: number): boolean;
}

/**
 * TtlDedupStore —— 带 TTL 与上限保护的内存去重表。
 *
 * 用 `Map<key, expireAt>` 记录每个指纹的过期时刻；`Map` 迭代序即插入序，
 * 超过 `maxSize` 时先清扫过期项、仍超限再淘汰最早写入项，保证内存有界。
 */
export class TtlDedupStore implements DedupStore {
  private readonly expiry = new Map<string, number>();

  constructor(private readonly maxSize = 5_000) {}

  seen(key: string, now: number, windowMs: number): boolean {
    const expireAt = this.expiry.get(key);
    if (expireAt !== undefined && expireAt > now) return true; // 窗口内 → 重复
    // 未见过或已过期：刷新窗口（重新计时）
    this.expiry.set(key, now + windowMs);
    if (this.expiry.size > this.maxSize) this.evict(now);
    return false;
  }

  /** 超限时：先删过期项，仍超限再按插入序淘汰最早的。 */
  private evict(now: number): void {
    for (const [k, exp] of this.expiry) {
      if (exp <= now) this.expiry.delete(k);
    }
    if (this.expiry.size <= this.maxSize) return;
    const overflow = this.expiry.size - this.maxSize;
    let i = 0;
    for (const k of this.expiry.keys()) {
      if (i++ >= overflow) break;
      this.expiry.delete(k);
    }
  }
}

/** payload 序列化兜底（非错误类型 / 未知 kind 时用），异常安全。 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

/**
 * fingerprint —— 按 `kind` 取**稳定**字段拼接后哈希。
 *
 * 不同错误种类用不同的判同维度：js 用 message+脚本位置；resource 用 url+种类；
 * promise 用 reason。开放 kind / 非错误事件回退到 type+payload 序列化。
 * 不依赖 stack 解析结果，故与 STRUCTURAL 阶段的 stack-normalize 无顺序耦合。
 */
export function fingerprint(event: BaseEvent): string {
  const parts: string[] = [event.type];
  const p = event.payload as Partial<ErrorPayload> | null;

  if (p && typeof p === "object" && typeof (p as ErrorPayload).kind === "string") {
    const ep = p as ErrorPayload;
    switch (ep.kind) {
      case "js":
        parts.push(
          "js",
          ep.message,
          ep.source ?? "",
          String(ep.lineno ?? ""),
          String(ep.colno ?? ""),
        );
        break;
      case "resource":
        parts.push("resource", ep.url, ep.resourceType);
        break;
      case "promise":
        parts.push("promise", ep.reason);
        break;
      default:
        parts.push(String((ep as { kind: string }).kind), safeStringify(ep));
    }
  } else {
    parts.push(safeStringify(event.payload));
  }

  return fnv1a(parts.join("|"));
}

/** dedup 中间件配置。 */
export interface DedupOptions {
  /** 去重窗口（毫秒），同指纹在窗口内只放行一次。默认 5000。 */
  windowMs?: number;
  /** store 容量上限，防止指纹无界增长。默认 5000。 */
  maxSize?: number;
  /** 适用的事件类型；其余类型直接放行。默认仅 ["error"]。 */
  types?: string[];
}

/**
 * createDedupMiddleware —— POLICY 阶段去重层（filter 之后、rateLimit 之前）。
 *
 * 排在 rateLimit 前：重复事件不应消耗限流令牌。只对 `types` 命中的类型去重，
 * 默认仅错误事件（behavior/performance 等每条都有意义，不去重）。
 */
export function createDedupMiddleware(
  options: DedupOptions = {},
  runtime: EventRuntime = defaultRuntime,
  store: DedupStore = new TtlDedupStore(options.maxSize),
): Middleware {
  const windowMs = options.windowMs ?? 5_000;
  const types = new Set(options.types ?? ["error"]);

  return {
    name: "dedup",
    type: MiddlewareType.POLICY,
    priority: BUILTIN_PRIORITY.dedup,
    handle: async (event, next) => {
      if (!types.has(event.type)) return next(event);
      if (store.seen(fingerprint(event), runtime.now(), windowMs)) return null;
      return next(event);
    },
  };
}
