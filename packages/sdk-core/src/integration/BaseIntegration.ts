import type { EventType } from "@monitor/event-contract";
import { createEvent } from "@monitor/event-contract";
import type { Client } from "../client/Client";
import type { Integration } from "./Integration";

/**
 * 插件标准模板 —— 把每个 Integration 都要重复的四件事收敛到一处：
 *
 * 1. SSR / 能力降级：`isSupported()` 不满足时 setup 直接跳过，不装任何 hook；
 * 2. client 持有：setup 注入后由基类保存，子类用 `this.emit` 上报即可；
 * 3. teardown 清理：子类用 `onCleanup` 就地登记解绑逻辑，基类统一 LIFO 执行 + 容错；
 * 4. 事件上报：`emit` 一步完成 createEvent + client.capture。
 *
 * 子类只需声明 `name`、实现 `install()`（装 runtime hook）、按需覆写 `isSupported()`。
 * 仍是 `implements Integration`，对 Core 透明；不需要基类能力的插件可直接裸实现接口。
 */
export abstract class BaseIntegration implements Integration {
  /** 插件名称，便于调试与去重。 */
  abstract name: string;

  /** 当前注入的 Client；仅在 `isSupported()` 通过并 setup 后可用。 */
  protected client?: Client;

  /** teardown 时需要回滚的解绑函数集合。 */
  private readonly cleanups: Array<() => void> = [];

  setup(client: Client): void {
    // 运行时不支持（SSR / 缺能力）时不装任何 hook，保持 teardown 幂等安全。
    if (!this.isSupported()) return;
    this.client = client;
    this.install(client);
  }

  teardown(): void {
    // LIFO 回滚：后装的 hook 先解绑；单个解绑失败不阻断其余清理。
    while (this.cleanups.length > 0) {
      try {
        this.cleanups.pop()!();
      } catch {
        // 忽略单点清理异常（节点已卸载 / 全局已被他处还原）
      }
    }
    this.client = undefined;
  }

  /**
   * 子类在此安装 runtime hooks（监听 / patch 全局方法 / 注册 observer），
   * 并用 `this.onCleanup(fn)` 就地登记对应的解绑逻辑。
   */
  protected abstract install(client: Client): void;

  /**
   * 运行时能力探测；默认要求浏览器环境。
   * 需要额外能力（fetch / IntersectionObserver …）的子类覆写收窄。
   */
  protected isSupported(): boolean {
    // sdk-core 不引入 DOM lib，用 globalThis 探测浏览器环境，避免依赖 window 类型声明。
    return typeof globalThis !== "undefined" && "window" in globalThis;
  }

  /** 登记一条解绑逻辑，teardown 时统一执行。 */
  protected onCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }

  /**
   * 便捷上报：createEvent + client.capture 一步到位（id/时间/平台均取自 client 的 runtime）。
   * `getRuntime?.()` 容忍仅实现 capture 的精简 client（测试替身）：缺失时回落契约默认 runtime。
   */
  protected emit<T>(type: EventType, payload: T): void {
    const client = this.client;
    if (!client) return;
    client.capture(
      createEvent(type, payload, client.platform, client.getRuntime?.()),
    );
  }
}
