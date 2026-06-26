import type { EventRuntime } from "@monitor/event-contract";
import { defaultRuntime } from "@monitor/event-contract";
import type { Middleware } from "./MiddlewarePipeline";
import { MiddlewareType } from "./MiddlewarePipeline";
import { BUILTIN_PRIORITY } from "./builtins";

/**
 * TokenBucket —— 令牌桶限流。
 *
 * 与文档草图的关键差异：时间由 `now` **传入**，桶自身不调用 `Date.now()`——
 * 与本仓库 RuntimePlatform 去全局化一致，也让突发/恢复行为可被确定性测试。
 *
 * 语义：容量 `capacity` 决定可承受的突发量；`refillPerSec` 决定恢复速率。
 * 每次 `allow(now)` 先按距上次的时间差补充令牌（不超过容量），再尝试扣 1。
 */
export class TokenBucket {
  private tokens: number;
  private last: number | null = null;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  allow(now: number): boolean {
    // 首次调用以本次时刻为基准，避免用未知的初始时间错误补水
    if (this.last === null) this.last = now;

    const deltaSec = Math.max(0, (now - this.last) / 1000);
    this.tokens = Math.min(this.capacity, this.tokens + deltaSec * this.refillPerSec);
    this.last = now;

    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** rateLimit 中间件配置。 */
export interface RateLimitOptions {
  /** 桶容量（可承受的突发条数）。默认 100。 */
  capacity?: number;
  /** 每秒补充的令牌数（稳态速率）。默认 50。 */
  refillPerSec?: number;
  /** 适用的事件类型；其余类型直接放行。默认全部类型共用一个全局桶。 */
  types?: string[];
}

/**
 * createRateLimitMiddleware —— POLICY 阶段限流层（dedup 之后、sample 之前）。
 *
 * 默认所有类型共用一个全局令牌桶（防 CDN 挂掉式的整体打爆）；若指定 `types`，
 * 则只对这些类型限流、其余放行。超额返回 null 丢弃。
 */
export function createRateLimitMiddleware(
  options: RateLimitOptions = {},
  runtime: EventRuntime = defaultRuntime,
): Middleware {
  const bucket = new TokenBucket(options.capacity ?? 100, options.refillPerSec ?? 50);
  const types = options.types ? new Set(options.types) : null;

  return {
    name: "rateLimit",
    type: MiddlewareType.POLICY,
    priority: BUILTIN_PRIORITY.rateLimit,
    handle: async (event, next) => {
      if (types && !types.has(event.type)) return next(event);
      if (!bucket.allow(runtime.now())) return null;
      return next(event);
    },
  };
}
