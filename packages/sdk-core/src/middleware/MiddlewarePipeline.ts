import type { BaseEvent } from "@monitor/event-contract";

/**
 * next —— 把事件交给链路中的下一个 middleware。
 * 返回最终处理结果：BaseEvent 表示继续向下，null 表示事件已在某一层被丢弃。
 */
export type Next = (event: BaseEvent) => Promise<BaseEvent | null>;

/**
 * Middleware 分类 —— 决定执行阶段，避免“纯 priority”模型下顺序难以推理。
 * 固定阶段序：STRUCTURAL → CONTEXTUAL → POLICY；同阶段内再按 priority 降序。
 *
 *  - STRUCTURAL：结构化，补齐/规整事件结构（normalize）。
 *  - CONTEXTUAL：上下文增强，注入运行时维度（url / userAgent 等）。
 *  - POLICY：策略决策，决定事件去留（filter / sample / 限流 / 去重）。
 */
export enum MiddlewareType {
  STRUCTURAL = "structural",
  CONTEXTUAL = "contextual",
  POLICY = "policy",
}

/** 阶段执行顺序：数值越小越先执行。 */
const TYPE_ORDER: Record<MiddlewareType, number> = {
  [MiddlewareType.STRUCTURAL]: 0,
  [MiddlewareType.CONTEXTUAL]: 1,
  [MiddlewareType.POLICY]: 2,
};

/** 未声明 type 的 middleware 默认归入 CONTEXTUAL（中间阶段，最不易出错）。 */
const DEFAULT_TYPE = MiddlewareType.CONTEXTUAL;

/**
 * Middleware —— 事件处理链中的一环（类比 Koa / Redux middleware）。
 * 每一层都可以：改写事件、丢弃事件（return null）、增强后交给 next 继续。
 */
export interface Middleware {
  /** 名称，便于调试与去重 */
  name: string;
  /** 分类，决定执行阶段；缺省视为 CONTEXTUAL */
  type?: MiddlewareType;
  /** 同阶段内的优先级，数值越大越先执行；缺省视为 0 */
  priority?: number;
  /** 处理逻辑：拿到事件后自行决定是否调用 next 继续向下 */
  handle(event: BaseEvent, next: Next): Promise<BaseEvent | null>;
}

/** debug 钩子：每个 middleware 执行前回调，用于事件流追踪。 */
export type MiddlewareTap = (name: string, event: BaseEvent) => void;

/**
 * MiddlewarePipeline —— 可插拔的事件处理链执行器。
 *
 * 本质等价于 Koa 的洋葱模型：dispatch(0) 触发第一个 middleware，
 * 每个 middleware 通过 next 决定是否驱动下一个。任意一层返回 null 即终止链路。
 *
 * 排序规则：先按 MiddlewareType 阶段序（STRUCTURAL→CONTEXTUAL→POLICY），
 * 同阶段内按 priority 降序；V8 稳定排序保证同序项维持注册先后。
 */
export class MiddlewarePipeline {
  private readonly middlewares: Middleware[] = [];

  /** 可选的执行追踪钩子（debug 模式注入）。 */
  constructor(private readonly tap?: MiddlewareTap) {}

  /** 注册一个 middleware，并按 阶段序 → priority 重新排序。 */
  use(mw: Middleware): this {
    this.middlewares.push(mw);
    this.middlewares.sort((a, b) => {
      const at = TYPE_ORDER[a.type ?? DEFAULT_TYPE];
      const bt = TYPE_ORDER[b.type ?? DEFAULT_TYPE];
      if (at !== bt) return at - bt; // 不同阶段：按阶段序
      return (b.priority ?? 0) - (a.priority ?? 0); // 同阶段：priority 降序
    });
    return this;
  }

  /**
   * 执行整条链路，返回最终事件或 null（被丢弃）。
   * @internal 仅供 Client 编排调用；其它模块不应直接驱动 pipeline。
   */
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

      this.tap?.(mw.name, ev);
      return mw.handle(ev, (nextEvent) => dispatch(i + 1, nextEvent));
    };

    return dispatch(0, event);
  }
}
