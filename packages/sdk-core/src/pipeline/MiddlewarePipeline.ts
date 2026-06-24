import type { BaseEvent } from "@monitor/event-contract";

/**
 * next —— 把事件交给链路中的下一个 middleware。
 * 返回最终处理结果：BaseEvent 表示继续向下，null 表示事件已在某一层被丢弃。
 */
export type Next = (event: BaseEvent) => Promise<BaseEvent | null>;

/**
 * Middleware —— 事件处理链中的一环（类比 Koa / Redux middleware）。
 * 每一层都可以：改写事件、丢弃事件（return null）、增强后交给 next 继续。
 */
export interface Middleware {
  /** 名称，便于调试与去重 */
  name: string;
  /** 优先级，数值越大越先执行；缺省视为 0 */
  priority?: number;
  /** 处理逻辑：拿到事件后自行决定是否调用 next 继续向下 */
  handle(event: BaseEvent, next: Next): Promise<BaseEvent | null>;
}

/**
 * MiddlewarePipeline —— 可插拔的事件处理链执行器。
 *
 * 本质等价于 Koa 的洋葱模型：dispatch(0) 触发第一个 middleware，
 * 每个 middleware 通过 next 决定是否驱动下一个。任意一层返回 null 即终止链路。
 */
export class MiddlewarePipeline {
  private readonly middlewares: Middleware[] = [];

  /** 注册一个 middleware，并按优先级降序重新排序。 */
  use(mw: Middleware): this {
    this.middlewares.push(mw);
    // sort 在 V8 中是稳定排序：同优先级时保持注册先后顺序
    this.middlewares.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  /** 执行整条链路，返回最终事件或 null（被丢弃）。 */
  async execute(event: BaseEvent): Promise<BaseEvent | null> {
    let index = -1;

    const dispatch = async (
      i: number,
      ev: BaseEvent,
    ): Promise<BaseEvent | null> => {
      // 防御：同一个 next 被调用多次会破坏链路语义
      if (i <= index) throw new Error("next() 被重复调用");
      index = i;

      const mw = this.middlewares[i];
      if (!mw) return ev; // 链路走到尽头，原样返回

      return mw.handle(ev, (nextEvent) => dispatch(i + 1, nextEvent));
    };

    return dispatch(0, event);
  }
}
