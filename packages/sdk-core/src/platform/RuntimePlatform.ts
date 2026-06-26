import type { EventRuntime } from "@monitor/event-contract";
import { defaultRuntime } from "@monitor/event-contract";

/**
 * 全局原语 —— 出口（fetch / sendBeacon）与运行时上下文（url / userAgent）
 * 增强所需的宿主能力，外加一个环境探测位。
 *
 * 各端各自提供：web → 包装 `globalThis`；小程序 → 包装 `wx.*`；RN → 包装其全局。
 * 全部可选，缺失即安全降级（SSR / Node / 老旧 runtime 不应让 SDK 崩）。
 */
export interface RuntimeGlobal {
  /** 网络出口主通道 */
  fetch?: typeof fetch;
  /** UA 与卸载期兜底发送 */
  navigator?: {
    userAgent?: string;
    sendBeacon?: (url: string, data?: string) => boolean;
  };
  /** 当前页面 / 屏幕地址 */
  location?: { href?: string };
  /** 环境探测：是否具备 DOM（供需要浏览器环境的插件判定支持性） */
  hasDOM?: boolean;
}

/**
 * RuntimePlatform —— 平台适配口（Platform Adapter）。
 *
 * = 契约原语（now / uuid，来自 event-contract 的 EventRuntime）
 * + 全局原语（fetch / navigator / location，本层新增）。
 *
 * Client 持有**唯一实例**并向下分发（middleware / transport / hub / integration），
 * 把原本散落在核心逻辑里的 `Date.now()` / `crypto.randomUUID()` / `globalThis`
 * 收敛到这一个可注入的接口上。跨端只需替换它，核心代码零改动。
 */
export interface RuntimePlatform extends EventRuntime {
  /** 全局原语快照入口（getter 实现可保持惰性，便于测试 stub）。 */
  readonly global: RuntimeGlobal;
}

/**
 * web / Node 默认实现 —— 不显式注入平台时的兜底。
 *
 * `global` 用 getter 惰性读取 `globalThis`：每次访问时取，
 * 从而兼容测试里的 `vi.stubGlobal('fetch', ...)`，也避免模块加载期快照。
 * `now` / `uuid` 复用契约默认实现，保持与 event-contract 同源。
 */
export const webPlatform: RuntimePlatform = {
  now: () => defaultRuntime.now(),
  uuid: () => defaultRuntime.uuid(),
  get global(): RuntimeGlobal {
    const g = globalThis as RuntimeGlobal & { window?: unknown };
    return {
      fetch: g.fetch,
      navigator: g.navigator,
      location: g.location,
      hasDOM: typeof globalThis !== "undefined" && "window" in globalThis,
    };
  },
};
