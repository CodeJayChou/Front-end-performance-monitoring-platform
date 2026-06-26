import type { EventRuntime } from "../runtime";
import { defaultRuntime } from "../runtime";

/**
 * Span —— 链路追踪的最小单元，表示一个子操作（fetch / render / compute）。
 * 通过 startTime / endTime 记录耗时，finish() 后即可上报。
 */
export interface SpanJSON {
  id: string;
  op: string;
  description?: string;
  /** 毫秒耗时；未 finish 时为 0 */
  duration: number;
}

export class Span {
  readonly id: string;
  readonly op: string;
  readonly description?: string;

  readonly startTime: number;
  endTime?: number;

  constructor(
    op: string,
    description?: string,
    private readonly runtime: EventRuntime = defaultRuntime,
  ) {
    this.op = op;
    this.description = description;
    this.id = runtime.uuid();
    this.startTime = runtime.now();
  }

  /** 标记结束，记录 endTime。 */
  finish(): void {
    this.endTime = this.runtime.now();
  }

  toJSON(): SpanJSON {
    return {
      id: this.id,
      op: this.op,
      description: this.description,
      duration: this.endTime ? this.endTime - this.startTime : 0,
    };
  }
}
