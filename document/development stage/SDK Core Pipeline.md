SDK Core Pipeline
严格按你当前架构模型来写：Platform → Core Pipeline → Event Contract → Transport。

重点是：可扩展 + 可插拔 + 单向数据流 + 强契约约束

1. Event Contract（先定义“数据宪法”）
// packages/types/src/event.ts

export type EventType = "error" | "performance" | "custom";

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: number;
  platform: "web" | "react" | "vue" | "app";
  name: string;
  payload: unknown;
}

export interface EnrichedEvent extends BaseEvent {
  context: {
    url?: string;
    route?: string;
    userAgent?: string;
    sessionId?: string;
    breadcrumbs?: string[];
  };
}

export type SDKEvent = BaseEvent | EnrichedEvent;
2. Pipeline Stage Interface（核心抽象）
// packages/core/src/pipeline/types.ts

import { SDKEvent } from "@monitor/types";

export interface PipelineContext {
  stop?: boolean;
}

export interface PipelineStage {
  name: string;
  run(event: SDKEvent, ctx: PipelineContext): SDKEvent | null;
}
3. Core Pipeline（唯一处理中心）
// packages/core/src/pipeline/corePipeline.ts

import { PipelineStage, PipelineContext } from "./types";
import { SDKEvent } from "@monitor/types";

export class SDKCorePipeline {
  private stages: PipelineStage[] = [];

  use(stage: PipelineStage) {
    this.stages.push(stage);
    return this;
  }

  process(event: SDKEvent): SDKEvent | null {
    const ctx: PipelineContext = {};

    let current: SDKEvent | null = event;

    for (const stage of this.stages) {
      if (!current) break;

      current = stage.run(current, ctx);

      // filter short-circuit
      if (!current) return null;
    }

    return current;
  }
}
4. Normalize Stage（平台差异消除）
// packages/core/src/stages/normalize.ts

import { PipelineStage } from "../pipeline/types";
import { SDKEvent } from "@monitor/types";

export const normalizeStage: PipelineStage = {
  name: "normalize",

  run(event: any): SDKEvent {
    return {
      id: event.id || String(Date.now()),
      type: event.type || "custom",
      timestamp: Date.now(),
      platform: event.platform || "web",
      name: event.name || "unknown",
      payload: event.payload || event,
    };
  },
};
5. Enrich Stage（上下文增强）
// packages/core/src/stages/enrich.ts

import { PipelineStage } from "../pipeline/types";
import { EnrichedEvent } from "@monitor/types";

export const enrichStage: PipelineStage = {
  name: "enrich",

  run(event: any): EnrichedEvent {
    return {
      ...event,
      context: {
        url: window.location.href,
        route: window.location.pathname,
        userAgent: navigator.userAgent,
        sessionId: "mock-session-id",
        breadcrumbs: [],
      },
    };
  },
};
6. Filter Stage（过滤无效数据）
// packages/core/src/stages/filter.ts

import { PipelineStage } from "../pipeline/types";

export const filterStage: PipelineStage = {
  name: "filter",

  run(event) {
    // 过滤 SDK 自身噪音
    if (event.name.includes("sdk_internal")) {
      return null;
    }

    // 过滤无意义事件
    if (!event.payload) {
      return null;
    }

    return event;
  },
};
7. Sampling Stage（采样控制）
// packages/core/src/stages/sampling.ts

import { PipelineStage } from "../pipeline/types";

export const samplingStage: PipelineStage = {
  name: "sampling",

  run(event) {
    const rate = 0.5; // 50% sample

    if (Math.random() > rate) {
      return null;
    }

    return event;
  },
};
8. Dispatch Stage（分发到 Transport）
// packages/core/src/stages/dispatch.ts

import { PipelineStage } from "../pipeline/types";
import { Transport } from "@monitor/transport";

export const dispatchStage = (transport: Transport) => ({
  name: "dispatch",

  run(event) {
    transport.send(event);
    return event;
  },
});
9. Transport Layer（只负责发送）
// packages/transport/src/index.ts

import { SDKEvent } from "@monitor/types";

export class Transport {
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  send(event: SDKEvent) {
    fetch(this.endpoint, {
      method: "POST",
      body: JSON.stringify(event),
      keepalive: true,
    });
  }
}
10. SDK 初始化入口（关键）
// packages/sdk-web/src/init.ts

import { SDKCorePipeline } from "@monitor/core";
import { normalizeStage } from "@monitor/core/stages/normalize";
import { enrichStage } from "@monitor/core/stages/enrich";
import { filterStage } from "@monitor/core/stages/filter";
import { samplingStage } from "@monitor/core/stages/sampling";
import { dispatchStage } from "@monitor/core/stages/dispatch";
import { Transport } from "@monitor/transport";

export function initSDK() {
  const transport = new Transport("/ingest");

  const pipeline = new SDKCorePipeline();

  pipeline
    .use(normalizeStage)
    .use(enrichStage)
    .use(filterStage)
    .use(samplingStage)
    .use(dispatchStage(transport));

  return pipeline;
}
11. Platform 层示例（web instrumentation）
// packages/sdk-web/src/instrumentation/error.ts

import { SDKCorePipeline } from "@monitor/core";

export function setupErrorTracking(pipeline: SDKCorePipeline) {
  window.onerror = (msg, src, line, col, err) => {
    pipeline.process({
      type: "error",
      name: "window_error",
      platform: "web",
      payload: {
        message: msg,
        stack: err?.stack,
        source: src,
        line,
        col,
      },
    });
  };
}
12. 使用方式
import { initSDK } from "@monitor/sdk-web";
import { setupErrorTracking } from "@monitor/sdk-web/instrumentation/error";

const pipeline = initSDK();

setupErrorTracking(pipeline);