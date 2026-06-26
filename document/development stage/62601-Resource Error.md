Resource Error

1. Resource Error 的定义边界

Resource Error 指的是：

浏览器在加载外部资源过程中发生失败或异常的情况

典型来源：

script 加载失败
css 加载失败
image 加载失败
font 加载失败
media（video/audio）加载失败
fetch/xmlhttprequest（在某些体系里会拆成 HTTP Error）

在浏览器层面主要来自：

window.addEventListener('error', ...)（捕获阶段）
PerformanceResourceTiming（辅助定位资源）
DOM element error event（img/script/link）
2. 在你的 Event Contract 中的位置

建议你把 Resource Error 定义为：

enum EventType {
  JS_ERROR = 'js_error',
  RESOURCE_ERROR = 'resource_error',
  HTTP_ERROR = 'http_error',
  PERFORMANCE = 'performance',
}
ResourceError Event Schema（核心）
export interface ResourceErrorEvent {
  type: 'resource_error';

  timestamp: number;

  url: string;              // 资源 URL
  tagName: string;          // script / img / link / video
  message: string;          // 错误描述（可标准化）

  pageUrl: string;

  statusCode?: number;      // 如果可推断（通常不可直接获取）
  initiatorType?: string;   // resource timing: script/img/css/font

  isCrossOrigin: boolean;

  domPath?: string;        // 关键定位字段
  xpath?: string;

  metadata: {
    resourceType: 'script' | 'img' | 'css' | 'font' | 'media' | 'other';
  };
}
3. Instrumentation 层实现（关键）

这一层的职责只有一个：

把浏览器行为 → 转换为 ResourceErrorEvent（不做处理逻辑）

3.1 基础监听（error capture phase）
export function initResourceErrorInstrumentation(dispatch) {
  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      const target = event.target as HTMLElement | null;

      if (!target) return;

      const tagName = target.tagName?.toLowerCase();

      if (!isResourceTag(tagName)) return;

      const url = extractResourceUrl(target);

      const payload = {
        type: 'resource_error',
        timestamp: Date.now(),
        url,
        tagName,
        message: `Resource load failed: ${tagName}`,
        pageUrl: location.href,
        isCrossOrigin: isCrossOriginUrl(url),
        metadata: {
          resourceType: normalizeResourceType(tagName),
        },
      };

      dispatch(payload);
    },
    true // capture phase 必须开启
  );
}
3.2 DOM 资源拦截辅助（补充 DOM Path）
function extractDomPath(el: HTMLElement): string {
  const path: string[] = [];

  while (el && el.nodeType === 1) {
    let selector = el.nodeName.toLowerCase();

    if (el.id) {
      selector += `#${el.id}`;
      path.unshift(selector);
      break;
    } else if (el.className) {
      selector += `.${el.className.split(' ').join('.')}`;
    }

    path.unshift(selector);
    el = el.parentElement!;
  }

  return path.join(' > ');
}
3.3 URL 提取策略
function extractResourceUrl(target: HTMLElement): string {
  if (target instanceof HTMLImageElement) return target.src;
  if (target instanceof HTMLScriptElement) return target.src;
  if (target instanceof HTMLLinkElement) return target.href;
  if (target instanceof HTMLVideoElement) return target.src;
  if (target instanceof HTMLAudioElement) return target.src;

  return '';
}
4. SDK Core Pipeline 中的处理

在你的架构里：

Instrumentation
   ↓
normalize
   ↓
enrich
   ↓
filter
   ↓
sampling
   ↓
dispatch
4.1 normalize（统一结构）
function normalizeResourceError(event) {
  return {
    ...event,
    type: 'resource_error',
    timestamp: event.timestamp ?? Date.now(),
  };
}
4.2 enrich（重点）

这一层是 Resource Error 的价值核心。

建议补充：

1. Resource Timing 对齐
function enrichWithResourceTiming(event) {
  const resources = performance.getEntriesByType('resource');

  const matched = resources.find(r =>
    r.name === event.url
  );

  if (!matched) return event;

  return {
    ...event,
    initiatorType: matched.initiatorType,
    duration: matched.duration,
    transferSize: matched.transferSize,
  };
}
2. 失败原因推断（关键能力）
function inferFailureReason(event) {
  if (event.isCrossOrigin) return 'cross_origin_blocked';
  if (event.url.includes('404')) return 'not_found';
  if (event.url.includes('cdn')) return 'cdn_failure';

  return 'unknown';
}
5. Event Contract 设计重点（避免未来爆炸）

Resource Error 最容易失控的点是：

类型过多（img/script/css/font/media）
平台差异（web / mobile webview）
可观测字段不一致