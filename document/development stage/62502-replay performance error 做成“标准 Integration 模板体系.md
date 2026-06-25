1. 设计核心原则（必须先统一）

在你这个监控体系里：

SDK Core = 唯一执行管道（不可变）
Integration = 能力插件（可增不改）
Event Contract = 数据契约（稳定版本化）

👉 所以 Integration 的本质是：

把“运行时能力”转换为 BaseEvent 的标准生产器

2. Integration 标准模型（统一抽象）

所有能力（Replay / Performance / Error）必须收敛为一个接口：

export interface Integration<TConfig = any> {
  name: string;

  setup(ctx: IntegrationContext, config: TConfig): void;

  start?(): void;
  stop?(): void;

  /**
   * 可选：声明能力依赖（用于编排）
   */
  dependencies?: string[];
}
3. IntegrationContext（关键枢纽）

Integration 不能直接碰 Core pipeline，而是通过 ctx：

export interface IntegrationContext {
  capture(event: BaseEvent): void;

  getClient(): Client;

  getConfig(): any;

  logger: Logger;

  /**
   * 用于跨 integration 通信（可选）
   */
  bus: EventBus;
}

👉 关键点：

Integration 只能 emit event
不能修改 pipeline
不能绕过 capture
4. 标准 Integration 模板（核心）

所有能力统一写成这个结构：

export function defineIntegration<TConfig>(
  factory: (options: TConfig) => Integration<TConfig>
) {
  return factory;
}
5. 三大标准 Integration 模板实现
5.1 Error Integration（错误标准模板）
export const ErrorIntegration = defineIntegration(() => ({
  name: "error",

  setup(ctx) {
    window.addEventListener("error", (e) => {
      ctx.capture({
        type: "error",
        category: "js_error",
        timestamp: Date.now(),
        payload: {
          message: e.message,
          stack: e.error?.stack,
          filename: e.filename,
          lineno: e.lineno,
        },
      });
    });

    window.addEventListener("unhandledrejection", (e) => {
      ctx.capture({
        type: "error",
        category: "promise_rejection",
        timestamp: Date.now(),
        payload: {
          reason: e.reason,
        },
      });
    });
  },
}));
5.2 Performance Integration（性能标准模板）
export const PerformanceIntegration = defineIntegration(() => ({
  name: "performance",

  setup(ctx) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      for (const entry of entries) {
        ctx.capture({
          type: "performance",
          category: entry.entryType,
          timestamp: Date.now(),
          payload: serializePerformanceEntry(entry),
        });
      }
    });

    observer.observe({
      entryTypes: [
        "navigation",
        "resource",
        "paint",
        "largest-contentful-paint",
      ],
    });
  },
}));
5.3 Replay Integration（行为录制模板）
export const ReplayIntegration = defineIntegration(() => ({
  name: "replay",

  setup(ctx) {
    const buffer: any[] = [];

    const push = (event: any) => {
      buffer.push({
        t: Date.now(),
        ...event,
      });

      if (buffer.length > 200) buffer.shift();
    };

    document.addEventListener("click", (e) => {
      push({
        type: "click",
        x: e.clientX,
        y: e.clientY,
        tag: (e.target as HTMLElement)?.tagName,
      });
    });

    document.addEventListener("input", (e) => {
      push({
        type: "input",
        tag: (e.target as HTMLElement)?.tagName,
      });
    });

    setInterval(() => {
      ctx.capture({
        type: "replay",
        category: "batch",
        timestamp: Date.now(),
        payload: {
          events: [...buffer],
        },
      });
    }, 5000);
  },
}));
6. Integration Registry（注册体系）
export class IntegrationRegistry {
  private integrations: Integration[] = [];

  register(integration: Integration) {
    this.integrations.push(integration);
  }

  setupAll(ctx: IntegrationContext) {
    for (const integration of this.integrations) {
      integration.setup(ctx, {} as any);
    }
  }
}
7. SDK Core 如何消费（关键）

Core 完全不关心 Replay / Error / Perf：

const registry = new IntegrationRegistry();

registry.register(ErrorIntegration());
registry.register(PerformanceIntegration());
registry.register(ReplayIntegration());

registry.setupAll({
  capture: client.capture,
  getClient: () => client,
  getConfig: () => config,
  logger,
  bus,
});
8. 体系化结论（重点）

你现在这套设计完成后，你得到的是：

✔ 能力层解耦
Error / Perf / Replay 完全独立
不互相依赖
✔ SDK Core 极简化

Core 只做：

BaseEvent → normalize → enrich → filter → sample → dispatch
✔ 新能力扩展方式变成：
新增 Integration 文件即可
不动 Core
不动 pipeline
不动 contract