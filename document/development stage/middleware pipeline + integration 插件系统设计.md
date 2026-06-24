1. 总体设计（Sentry 类比模型）

可以把系统拆成 4 层：

SDK Core
  ↓
Hub（运行时容器）
  ↓
Client（事件入口 + pipeline）
  ↓
Middleware Pipeline（可插拔处理链）
  ↓
Integrations（插件系统：Error/Perf/Replay/Network）
核心思想（很关键）
1）Middleware = “事件处理链”

类似 Koa / Redux middleware：

event 在 pipeline 中流动，每一层可以：

修改 event
丢弃 event
生成新 event
上报/采样/增强
2）Integration = “能力插件”

例如：

ErrorIntegration
PerformanceIntegration
ReplayIntegration
NetworkIntegration

它们的本质：

注册 middleware + lifecycle hooks

3）Hub = “运行时上下文容器”

类似 Sentry Hub：

管理当前 scope
管理 client
管理 integrations
支持 runInContext（隔离链路）
2. 核心数据结构（Event Contract 稳定层）
export interface MonitorEvent {
  id: string;
  type: 'error' | 'performance' | 'replay' | 'custom';

  timestamp: number;

  platform: 'web' | 'h5' | 'node';

  message?: string;

  error?: {
    name: string;
    stack?: string;
  };

  context?: Record<string, any>;

  tags?: Record<string, string>;

  breadcrumbs?: any[];
}

👉 重点：
event contract 是跨平台稳定层（你之前担心“不能变”的核心）

3. Middleware Pipeline（核心）
3.1 Middleware 类型
export type Next = (event: MonitorEvent) => Promise<MonitorEvent | null>;

export interface Middleware {
  name: string;
  priority?: number;

  handle(event: MonitorEvent, next: Next): Promise<MonitorEvent | null>;
}
3.2 Pipeline 执行器（核心）
export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  use(mw: Middleware) {
    this.middlewares.push(mw);
    this.middlewares.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async execute(event: MonitorEvent): Promise<MonitorEvent | null> {
    let index = -1;

    const dispatch = async (i: number, ev: MonitorEvent): Promise<MonitorEvent | null> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;

      const mw = this.middlewares[i];
      if (!mw) return ev;

      return mw.handle(ev, (nextEvent) => dispatch(i + 1, nextEvent));
    };

    return dispatch(0, event);
  }
}
✔ 这个设计的本质

等价于：

Koa middleware model
Redux middleware
Sentry event processors
4. Integration 插件系统（重点）
4.1 Integration 接口
export interface Integration {
  name: string;

  setup(client: MonitorClient): void;

  // 可选 hook
  beforeSend?(event: MonitorEvent): MonitorEvent | null;
}
4.2 Client（核心执行器）
export class MonitorClient {
  private pipeline = new MiddlewarePipeline();
  private integrations = new Map<string, Integration>();

  constructor() {}

  use(integration: Integration) {
    this.integrations.set(integration.name, integration);
    integration.setup(this);
  }

  addMiddleware(mw: Middleware) {
    this.pipeline.use(mw);
  }

  async capture(event: MonitorEvent) {
    // 1. integration hook（同步增强）
    for (const it of this.integrations.values()) {
      if (it.beforeSend) {
        const result = it.beforeSend(event);
        if (!result) return;
        event = result;
      }
    }

    // 2. middleware pipeline
    const processed = await this.pipeline.execute(event);

    // 3. 最终上报
    if (processed) {
      this.send(processed);
    }
  }

  private send(event: MonitorEvent) {
    console.log('send event:', event);
  }
}
5. 动态注册系统（重点工程能力）

你关心的“运行时可扩展”在这里实现：

5.1 Integration Registry
export class IntegrationRegistry {
  private factories = new Map<string, () => Integration>();

  register(name: string, factory: () => Integration) {
    this.factories.set(name, factory);
  }

  create(name: string): Integration | null {
    const factory = this.factories.get(name);
    return factory ? factory() : null;
  }
}
5.2 动态加载（关键）
export class DynamicLoader {
  constructor(
    private registry: IntegrationRegistry,
    private client: MonitorClient
  ) {}

  enable(name: string) {
    const integration = this.registry.create(name);
    if (!integration) return;

    this.client.use(integration);
  }
}
✔ 这就实现了：
✔ runtime 插件开启/关闭
✔ 不改 SDK core
✔ 按需加载能力模块
6. Integration 示例（Error + Performance）
Error Integration
export class ErrorIntegration implements Integration {
  name = 'error';

  setup(client: MonitorClient) {
    window.addEventListener('error', (e) => {
      client.capture({
        id: crypto.randomUUID(),
        type: 'error',
        timestamp: Date.now(),
        platform: 'web',
        error: {
          name: e.message,
          stack: e.error?.stack,
        },
      });
    });
  }
}
Performance Integration
export class PerformanceIntegration implements Integration {
  name = 'performance';

  setup(client: MonitorClient) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        client.capture({
          id: crypto.randomUUID(),
          type: 'performance',
          timestamp: Date.now(),
          platform: 'web',
          context: entry.toJSON(),
        });
      }
    });

    observer.observe({ entryTypes: ['navigation', 'resource'] });
  }
}
7. Middleware 示例（非常关键）
7.1 Sampling Middleware
export const samplingMiddleware: Middleware = {
  name: 'sampling',
  priority: 100,

  async handle(event, next) {
    if (Math.random() < 0.5) return null;
    return next(event);
  },
};
7.2 Context Enrichment Middleware
export const contextMiddleware: Middleware = {
  name: 'context',

  async handle(event, next) {
    event.context = {
      url: location.href,
      userAgent: navigator.userAgent,
      ...event.context,
    };

    return next(event);
  },
};
8. 完整运行方式
const registry = new IntegrationRegistry();

registry.register('error', () => new ErrorIntegration());
registry.register('perf', () => new PerformanceIntegration());

const client = new MonitorClient();

client.addMiddleware(samplingMiddleware);
client.addMiddleware(contextMiddleware);

const loader = new DynamicLoader(registry, client);

loader.enable('error');
loader.enable('perf');