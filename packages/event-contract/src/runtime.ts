/**
 * 运行时原语 —— 契约层唯一依赖的两个能力：取时间、生成 id。
 *
 * 抽成接口，让 event-contract 不再硬编码 `Date.now()` / `crypto.randomUUID()`。
 * 真正跨端时（RN 旧环境、部分小程序无 `crypto.randomUUID`），由各端 SDK 注入
 * 自己的实现即可，契约的结构与逻辑保持纯净、不绑任何宿主全局。
 */
export interface EventRuntime {
  /** 毫秒时间戳；取代 `Date.now()`。 */
  now(): number;
  /** 事件 / span / trace 的唯一 id；取代 `crypto.randomUUID()`。 */
  uuid(): string;
}

/**
 * 默认实现 —— 浏览器 / Node 通用，作为不显式注入时的兜底。
 *
 * 关键：惰性读取 `globalThis`（在每次调用时取，而非模块加载时快照），
 * 以保证测试可通过 `vi.stubGlobal` 改写全局；缺 `crypto.randomUUID` 的老环境
 * 降级到「时间戳 + 随机数」，仅需本地唯一即可满足事件去重。
 *
 * 跨端时此默认会被各端注入的 `EventRuntime` 替换，故它出现 `globalThis`
 * 不破坏「契约逻辑不碰全局」这一约束——逻辑路径走的是注入，全局只活在兜底里。
 */
export const defaultRuntime: EventRuntime = {
  now: () => Date.now(),
  uuid: () =>
    (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      ?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
};
