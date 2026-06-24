import type { Scope } from "../client/Scope";
import type { Middleware } from "./MiddlewarePipeline";
import { normalize } from "./normalize";
import { enrich } from "./enrich";
import { filter } from "./filter";
import { sample } from "./sampling";

/**
 * 内置 middleware 的优先级。
 * 保证默认链路顺序为 normalize → enrich → filter → sample；
 * 数值留有余量，用户自定义 middleware 可通过更高/更低优先级插到链路任意位置。
 */
export const BUILTIN_PRIORITY = {
  normalize: 100,
  enrich: 90,
  filter: 80,
  sample: 70,
} as const;

/** normalize middleware：补齐 timestamp / platform / context。 */
export function createNormalizeMiddleware(platform: string): Middleware {
  return {
    name: "normalize",
    priority: BUILTIN_PRIORITY.normalize,
    handle: (event, next) => next(normalize(event, platform)),
  };
}

/** enrich middleware：把 Scope 上下文合并进事件。 */
export function createEnrichMiddleware(scope: Scope): Middleware {
  return {
    name: "enrich",
    priority: BUILTIN_PRIORITY.enrich,
    handle: (event, next) => next(enrich(event, scope)),
  };
}

/** filter middleware：丢弃结构非法的事件。 */
export function createFilterMiddleware(): Middleware {
  return {
    name: "filter",
    priority: BUILTIN_PRIORITY.filter,
    handle: async (event, next) => {
      const filtered = filter(event);
      if (!filtered) return null;
      return next(filtered);
    },
  };
}

/** sample middleware：按采样率决定是否保留事件。 */
export function createSampleMiddleware(rate: number): Middleware {
  return {
    name: "sample",
    priority: BUILTIN_PRIORITY.sample,
    handle: async (event, next) => {
      const sampled = sample(event, rate);
      if (!sampled) return null;
      return next(sampled);
    },
  };
}
