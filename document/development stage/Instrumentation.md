在你当前的前端监控架构里，Instrumentation 层的定位必须非常明确：

只负责“采集运行时信号 → 转换为标准 Event Contract”，不允许包含任何业务逻辑、聚合逻辑或处理逻辑。

它本质是 Platform Adapter Layer（平台适配层）。

下面给你一个工程级可扩展的 Instrumentation 设计 + 代码示例（SDK-web / SDK-core 分层一致）。

1. Instrumentation 的职责边界（必须先明确）

Instrumentation 只做三件事：

✔ 1）监听 runtime 信号
window error
promise rejection
fetch / xhr
performance API
user interaction
✔ 2）转换为原始 Event Raw Data
结构尽量“脏”，贴近平台
✔ 3）交给 SDK Core
core.ingest(event)
❌ 禁止做
不做 normalize
不做 enrich
不做 sampling
不做 filter
不做 dispatch
2. 架构关系（对应你当前体系）
sdk-web (Instrumentation Layer)
    ↓
sdk-core (Pipeline: normalize → enrich → filter → sampling → dispatch)
    ↓
event-contract (schema)
    ↓
transport (send)
3. Instrumentation 设计模型

核心抽象：

interface Instrumentation {
  name: string;
  install(core: CoreAPI): void;
  uninstall(): void;
}

CoreAPI 是唯一入口：

interface CoreAPI {
  ingest(event: RawEvent): void;
}
4. 完整代码示例（可直接用）
4.1 SDK Core API（最小桥接）
// core-api.ts
export interface RawEvent {
  type: string;
  timestamp: number;
  payload: any;
  platform: 'web';
}

export interface CoreAPI {
  ingest(event: RawEvent): void;
}
4.2 Instrumentation 基类
// instrumentation.ts
import { CoreAPI } from './core-api';

export interface Instrumentation {
  name: string;
  install(core: CoreAPI): void;
  uninstall(): void;
}
4.3 Error Instrumentation（window error）
// error-instrumentation.ts
import { Instrumentation } from './instrumentation';
import { CoreAPI } from './core-api';

export class ErrorInstrumentation implements Instrumentation {
  name = 'error';

  private core?: CoreAPI;
  private onErrorBound = this.onError.bind(this);

  install(core: CoreAPI) {
    this.core = core;
    window.addEventListener('error', this.onErrorBound);
  }

  uninstall() {
    window.removeEventListener('error', this.onErrorBound);
  }

  private onError(event: ErrorEvent) {
    this.core?.ingest({
      type: 'error',
      timestamp: Date.now(),
      platform: 'web',
      payload: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      },
    });
  }
}
4.4 Promise Rejection Instrumentation
// promise-instrumentation.ts
import { Instrumentation } from './instrumentation';
import { CoreAPI } from './core-api';

export class PromiseInstrumentation implements Instrumentation {
  name = 'promise';

  private core?: CoreAPI;
  private handler = this.onReject.bind(this);

  install(core: CoreAPI) {
    this.core = core;
    window.addEventListener('unhandledrejection', this.handler);
  }

  uninstall() {
    window.removeEventListener('unhandledrejection', this.handler);
  }

  private onReject(event: PromiseRejectionEvent) {
    this.core?.ingest({
      type: 'promise_rejection',
      timestamp: Date.now(),
      platform: 'web',
      payload: {
        reason: event.reason,
      },
    });
  }
}
4.5 Fetch Instrumentation（性能 + API 监控）
// fetch-instrumentation.ts
import { Instrumentation } from './instrumentation';
import { CoreAPI } from './core-api';

export class FetchInstrumentation implements Instrumentation {
  name = 'fetch';

  private core?: CoreAPI;
  private originalFetch = window.fetch;

  install(core: CoreAPI) {
    this.core = core;

    const self = this;

    window.fetch = async function (...args: any[]) {
      const start = performance.now();

      try {
        const res = await self.originalFetch.apply(this, args);

        self.core?.ingest({
          type: 'http',
          timestamp: Date.now(),
          platform: 'web',
          payload: {
            method: args?.[1]?.method || 'GET',
            url: args[0],
            status: res.status,
            duration: performance.now() - start,
          },
        });

        return res;
      } catch (err) {
        self.core?.ingest({
          type: 'http_error',
          timestamp: Date.now(),
          platform: 'web',
          payload: {
            url: args[0],
            error: String(err),
          },
        });

        throw err;
      }
    };
  }

  uninstall() {
    window.fetch = this.originalFetch;
  }
}
5. SDK 初始化（组合所有 Instrumentation）
// sdk.ts
import { CoreAPI, RawEvent } from './core-api';
import { ErrorInstrumentation } from './error-instrumentation';
import { PromiseInstrumentation } from './promise-instrumentation';
import { FetchInstrumentation } from './fetch-instrumentation';

class Core implements CoreAPI {
  ingest(event: RawEvent) {
    console.log('[CORE INGEST]', event);
    // 下一步进入 pipeline: normalize → enrich → filter → sampling → dispatch
  }
}

export class MonitorSDK {
  private core = new Core();
  private instruments = [
    new ErrorInstrumentation(),
    new PromiseInstrumentation(),
    new FetchInstrumentation(),
  ];

  init() {
    this.instruments.forEach(i => i.install(this.core));
  }

  destroy() {
    this.instruments.forEach(i => i.uninstall());
  }
}

