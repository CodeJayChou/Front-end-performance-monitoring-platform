/**
 * 类型安全的事件总线。
 *
 * 用于解耦各采集模块与消费方：采集包（sdk-error / sdk-performance ...）只负责
 * 往总线 emit 事件，core / transport 通过 on 订阅消费，双方互不依赖。
 *
 * @example
 * interface Events {
 *   error: { message: string };
 *   "perf:lcp": number;
 * }
 * const bus = new EventBus<Events>();
 * const off = bus.on("error", (e) => console.log(e.message)); // e 被推断为 { message: string }
 * bus.emit("error", { message: "boom" });
 * off(); // 取消订阅
 */

/** 事件处理器：入参类型由对应事件的载荷决定。 */
export type EventHandler<T> = (payload: T) => void;

/** 取消订阅函数，调用即移除对应监听。 */
export type Unsubscribe = () => void;

/** 事件映射：键为事件名，值为该事件的载荷类型。 */
export type EventMap = Record<string, unknown>;

/** 处理器执行抛错时的回调。 */
export type ErrorHandler = (error: unknown, type: PropertyKey) => void;

interface Listener {
  fn: EventHandler<never>;
  once: boolean;
}

export interface EventBusOptions {
  /**
   * 处理器内部抛错时的回调。默认通过 console.error 上报，
   * 以保证“一个订阅者出错不影响其它订阅者”的隔离性。
   */
  onError?: ErrorHandler;
}

export class EventBus<M extends EventMap = EventMap> {
  readonly #listeners = new Map<keyof M, Set<Listener>>();
  readonly #onError: ErrorHandler;

  constructor(options: EventBusOptions = {}) {
    this.#onError =
      options.onError ??
      ((error, type) => {
        console.error(`[EventBus] handler for "${String(type)}" threw:`, error);
      });
  }

  /** 订阅事件，返回取消订阅函数。 */
  on<K extends keyof M>(type: K, handler: EventHandler<M[K]>): Unsubscribe {
    return this.#add(type, handler, false);
  }

  /** 订阅一次，触发后自动移除；返回取消订阅函数。 */
  once<K extends keyof M>(type: K, handler: EventHandler<M[K]>): Unsubscribe {
    return this.#add(type, handler, true);
  }

  /** 移除指定事件上与 handler 引用相同的监听（on / once 均可移除）。 */
  off<K extends keyof M>(type: K, handler: EventHandler<M[K]>): void {
    const set = this.#listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      if (listener.fn === handler) {
        set.delete(listener);
        break;
      }
    }
    if (set.size === 0) this.#listeners.delete(type);
  }

  /** 触发事件，按订阅顺序同步调用所有处理器；单个处理器抛错会被隔离。 */
  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.#listeners.get(type);
    if (!set || set.size === 0) return;
    // 快照：避免处理器在回调中增删监听导致迭代行为不确定。
    for (const listener of [...set]) {
      if (listener.once) set.delete(listener);
      try {
        (listener.fn as EventHandler<M[K]>)(payload);
      } catch (error) {
        this.#onError(error, type);
      }
    }
    if (set.size === 0) this.#listeners.delete(type);
  }

  /** 清空监听：传 type 仅清空该事件，否则清空全部。 */
  clear(type?: keyof M): void {
    if (type === undefined) this.#listeners.clear();
    else this.#listeners.delete(type);
  }

  /** 指定事件当前的监听数量，主要用于测试与调试。 */
  listenerCount(type: keyof M): number {
    return this.#listeners.get(type)?.size ?? 0;
  }

  #add<K extends keyof M>(type: K, handler: EventHandler<M[K]>, once: boolean): Unsubscribe {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    const listener: Listener = { fn: handler as EventHandler<never>, once };
    set.add(listener);
    return () => {
      const current = this.#listeners.get(type);
      if (current?.delete(listener) && current.size === 0) {
        this.#listeners.delete(type);
      }
    };
  }
}
