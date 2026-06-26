import { initWebSDK } from "@monitor/sdk-web";
import { createEvent } from "@monitor/event-contract";

/**
 * 浏览器触发页入口 —— 用 debug:true 打开事件流日志，肉眼走一遍完整链路：
 *   integration → scope → middleware:* → transport（或在某一段被 drop）。
 *
 * 这里把 Client 的 [SDK FLOW] 日志同时镜像到页面面板，无需开 DevTools 也能看。
 */

const panel = document.getElementById("log")!;

/** 把一行日志渲染到页面面板，并按 stage / drop 上色。 */
function render(label: string, payload?: unknown): void {
  const line = document.createElement("div");
  const cls = label.includes("drop")
    ? "drop"
    : label.startsWith("[SDK FLOW]")
      ? "stage"
      : "meta";
  let body = label;
  if (payload !== undefined) {
    try {
      body += " " + JSON.stringify(payload, null, 2);
    } catch {
      body += " " + String(payload);
    }
  }
  line.className = cls;
  line.textContent = body;
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
}

// 镜像 console.log：Client.log 用的就是 console.log(`[SDK FLOW] ...`, event)
const nativeLog = console.log.bind(console);
console.log = (...args: unknown[]): void => {
  nativeLog(...args);
  const [first, second] = args;
  if (typeof first === "string") render(first, second);
};

// 一行初始化；debug 打开事件流日志
const client = initWebSDK({
  debug: true,
  sampleRate: 1,
  beforeSend(event) {
    // 真实项目可在此过滤敏感数据 / 采样 / 返回 null 丢弃
    return event;
  },
});

// 写入上下文 + 开启 transaction：让每条事件都带上 context 与 trace
client.scope.setUser({ id: "u_1001" }).setRoute("/demo");
client.scope.addBreadcrumb("page load");
client.getHub().startTransaction("pageload", "navigation");

console.log("[demo] SDK initialized, platform =", client.platform);

const on = (id: string, fn: () => void): void => {
  document.getElementById(id)!.addEventListener("click", fn);
};

// 1. 未捕获错误：setTimeout 抛出 → 冒泡到 window.onerror → GlobalError 插件捕获
on("err", () => {
  console.log("[demo] → 触发未捕获错误");
  setTimeout(() => {
    throw new Error("demo uncaught error");
  });
});

// 2. 未处理 Promise rejection → window 'unhandledrejection' → PromiseRejection 插件
on("reject", () => {
  console.log("[demo] → 触发未处理 Promise rejection");
  void Promise.reject(new Error("demo unhandled rejection"));
});

// 3. fetch 成功：命中 dev server，返回 200 → Fetch 插件采集 http 事件
on("fetch-ok", () => {
  console.log("[demo] → 触发 fetch 成功");
  void fetch("/").catch(() => {});
});

// 4. fetch 失败：.invalid 域名必然 DNS 失败 → Fetch 插件采集 http_error 事件
on("fetch-fail", () => {
  console.log("[demo] → 触发 fetch 失败");
  void fetch("https://nonexistent.invalid/").catch(() => {});
});

// 5. 资源加载失败：插入一个坏 src 的 img → capture 阶段 'error' → ResourceError 插件
on("resource-err", () => {
  console.log("[demo] → 触发资源加载失败 (img)");
  const img = document.createElement("img");
  img.className = "demo-broken";
  // 必然 404 的同源路径，触发资源加载 error（不冒泡，仅 capture 阶段可见）
  img.src = `/__not_exist__/${performance.now()}.png`;
  document.body.appendChild(img);
});

// 6. 自定义事件：直接走 capture() 入口
on("custom", () => {
  console.log("[demo] → 触发自定义事件 capture()");
  void client.capture(
    createEvent("custom", { hello: "world", ts: performance.now() }, client.platform),
  );
});

// 7. 清空面板
on("clear", () => {
  panel.replaceChildren();
});
