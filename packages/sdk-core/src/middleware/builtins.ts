import type { EventRuntime } from "@monitor/event-contract";
import { defaultRuntime } from "@monitor/event-contract";
import type { Middleware } from "./MiddlewarePipeline";
import { MiddlewareType } from "./MiddlewarePipeline";
import { normalize } from "./normalize";
import { filter } from "./filter";
import { sample } from "./sampling";
import type { NormalizeMetadata } from "./normalize";

/**
 * 内置 middleware 的同阶段优先级（仅在各自 MiddlewareType 组内生效）。
 * 阶段序由 MiddlewareType 决定：STRUCTURAL → CONTEXTUAL → POLICY；
 * 这里的数值用于 POLICY 组内固定 filter → sample → dedup → rateLimit。
 */
export const BUILTIN_PRIORITY = {
  normalize: 100,
  stackNormalize: 90,
  filter: 80,
  sample: 78,
  dedup: 76,
  rateLimit: 74,
} as const;

/** normalize middleware（STRUCTURAL）：补齐 timestamp / platform / context。 */
export function createNormalizeMiddleware(
  platform: string,
  runtime: EventRuntime = defaultRuntime,
  metadata: NormalizeMetadata = {},
): Middleware {
  return {
    name: "normalize",
    type: MiddlewareType.STRUCTURAL,
    priority: BUILTIN_PRIORITY.normalize,
    handle: (event, next) => next(normalize(event, platform, runtime, metadata)),
  };
}

/** filter middleware（POLICY）：丢弃结构非法的事件。 */
export function createFilterMiddleware(): Middleware {
  return {
    name: "filter",
    type: MiddlewareType.POLICY,
    priority: BUILTIN_PRIORITY.filter,
    handle: async (event, next) => {
      const filtered = filter(event);
      if (!filtered) return null;
      return next(filtered);
    },
  };
}

/** sample middleware（POLICY）：按采样率决定是否保留事件。 */
export function createSampleMiddleware(rate: number, seed?: string): Middleware {
  return {
    name: "sample",
    type: MiddlewareType.POLICY,
    priority: BUILTIN_PRIORITY.sample,
    handle: async (event, next) => {
      const sampled = sample(event, rate, seed ?? event.id);
      if (!sampled) return null;
      return next(sampled);
    },
  };
}
