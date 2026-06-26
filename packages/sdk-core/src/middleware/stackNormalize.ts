import type { BaseEvent, StackFrame } from "@monitor/event-contract";
import type { Middleware } from "./MiddlewarePipeline";
import { MiddlewareType } from "./MiddlewarePipeline";
import { BUILTIN_PRIORITY } from "./builtins";

/**
 * StackParser —— 把某一平台的原始栈字符串解析为统一 StackFrame[]。
 * Web(V8/Safari) / RN(hermes) / Node(V8) 各有差异，故解析器由各平台 SDK 注入，
 * core 不写死任一平台格式（见 sdk-web 的 parseWebStack）。
 */
export type StackParser = (stack: string) => StackFrame[];

/** 仅错误 payload 关心 stack 字段。 */
interface StackBearing {
  stack?: string;
  stackFrames?: StackFrame[];
}

/**
 * createStackNormalizeMiddleware —— STRUCTURAL 阶段跨端栈归一。
 *
 * 只处理 `type:"error"` 且带原始 `stack` 字符串、尚未解析过的事件，把解析得到的
 * 结构化帧回填到 `payload.stackFrames`（保留原始 `stack` 不动）。排在 normalize 之后、
 * 进入 POLICY 之前，故 dedup 等下游可直接消费结构化栈。
 */
export function createStackNormalizeMiddleware(parser: StackParser): Middleware {
  return {
    name: "stackNormalize",
    type: MiddlewareType.STRUCTURAL,
    priority: BUILTIN_PRIORITY.stackNormalize,
    handle(event: BaseEvent, next) {
      if (event.type === "error") {
        const p = event.payload as StackBearing | null;
        if (p && typeof p === "object" && typeof p.stack === "string" && !p.stackFrames) {
          p.stackFrames = parser(p.stack);
        }
      }
      return next(event);
    },
  };
}
