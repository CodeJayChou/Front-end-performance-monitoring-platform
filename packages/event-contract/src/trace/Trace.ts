import { Span } from "./Span";
import type { SpanJSON } from "./Span";
import type { EventRuntime } from "../runtime";
import { defaultRuntime } from "../runtime";

/**
 * Transaction —— 一个完整操作的链路根节点（page load / click / api flow）。
 * 内部持有多个 Span（子操作），构成一棵单层 trace 树。
 *
 * id 同时充当 traceId：一次 transaction 内产生的所有 event 都可通过它关联，
 * 从而回答“这个 error 属于哪个 performance transaction”。
 */
export interface TransactionJSON {
  id: string;
  name: string;
  op: string;
  duration: number;
  spans: SpanJSON[];
}

export class Transaction {
  readonly id: string;
  readonly name: string;
  readonly op: string;

  readonly startTime: number;
  endTime?: number;
  readonly spans: Span[] = [];

  constructor(
    name: string,
    op: string,
    private readonly runtime: EventRuntime = defaultRuntime,
  ) {
    this.name = name;
    this.op = op;
    this.id = runtime.uuid();
    this.startTime = runtime.now();
  }

  /** 开启一个子操作 Span，并登记到当前 transaction。 */
  startSpan(op: string, description?: string): Span {
    const span = new Span(op, description, this.runtime);
    this.spans.push(span);
    return span;
  }

  /** 最近开启的 Span（用于把当前 event 关联到 spanId）。 */
  getActiveSpan(): Span | undefined {
    return this.spans[this.spans.length - 1];
  }

  /** 结束整个 transaction。 */
  finish(): void {
    this.endTime = this.runtime.now();
  }

  toJSON(): TransactionJSON {
    return {
      id: this.id,
      name: this.name,
      op: this.op,
      duration: (this.endTime ?? this.runtime.now()) - this.startTime,
      spans: this.spans.map((s) => s.toJSON()),
    };
  }
}
