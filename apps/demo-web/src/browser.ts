import { initWebSDK } from "@monitor/sdk-web";
import { createEvent } from "@monitor/event-contract";

/**
 * 浏览器触发页入口 —— 用 debug:true 打开事件流日志，肉眼走一遍完整链路：
 *   integration → scope → middleware:* → transport（或在某一段被 drop）。
 *
 * 这里把 Client 的 [SDK FLOW] 日志同时镜像到页面面板，无需开 DevTools 也能看。
 */

const panel = document.getElementById("log")!;

function busyWait(durationMs: number): void {
  const startedAt = performance.now();
  while (performance.now() - startedAt < durationMs) {
    // Deliberately block the main thread to create a measurable lab sample.
  }
}

function loadRenderScenario(): void {
  const params = new URLSearchParams(location.search);
  const scenario = params.get("perf");
  if (scenario === "slow-lcp") {
    const delay = Number(params.get("delay")) || 1_500;
    window.setTimeout(() => {
      const hero = document.getElementById("scenario-hero");
      if (!hero) return;
      hero.hidden = false;
      hero.textContent = "Delayed LCP hero";
    }, delay);
  }
  if (scenario === "blocked-fcp") busyWait(1_200);
}

// Run before SDK initialization so the scenario is part of the page's real
// paint lifecycle, rather than a synthetic performance event.
loadRenderScenario();

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
  dsn: "http://localhost:3001/api/v1/events/batch",
  projectId: "demo-project",
  sdkKey: "demo-public-key",
  environment: "development",
  release: "demo-web@0.1.0",
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

// Emit one deterministic page-load event so a fresh dashboard connection can
// verify the complete SDK → ingest → processor → query chain immediately.
void client.capture(
  createEvent("custom", { source: "demo-web", action: "page_load" }, client.platform),
);

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

// 生成一个明显的慢交互，确保本地演示能稳定观察到 INP 变化。
// SDK 已开启 reportAllChanges，无需切换标签页即可进入一分钟聚合桶。
on("inp", () => {
  busyWait(120);
  console.log("[demo] → 慢交互完成，INP 将实时上报");
});

function bindInteractionSample(id: string, durationMs: number): void {
  on(id, () => {
    busyWait(durationMs);
    console.log(`[perf-lab] → INP ${durationMs}ms interaction complete`);
  });
}

bindInteractionSample("inp-fast", 60);
bindInteractionSample("inp-medium", 240);
bindInteractionSample("inp-slow", 650);

function bindLayoutShiftSample(id: string, height: number): void {
  on(id, () => {
    console.log(`[perf-lab] → CLS ${height}px shift scheduled`);
    // Delay beyond the browser's recent-input window so the shift is counted
    // by CLS instead of being attributed to the button click.
    window.setTimeout(() => {
      const banner = document.createElement("div");
      banner.textContent = `Layout shift sample (${height}px)`;
      banner.style.height = `${height}px`;
      banner.style.display = "grid";
      banner.style.placeItems = "center";
      banner.style.background = "#d9962f33";
      banner.style.border = "1px dashed #d9962f";
      document.body.insertBefore(banner, panel);
    }, 700);
  });
}

bindLayoutShiftSample("cls-small", 80);
bindLayoutShiftSample("cls-large", 320);

on("longtask", () => {
  busyWait(900);
  console.log("[perf-lab] → Long Task 900ms complete; hide page to finalize");
});

function reloadScenario(scenario: string, delay?: number): void {
  const query = new URLSearchParams({ perf: scenario });
  if (delay !== undefined) query.set("delay", String(delay));
  location.href = `${location.pathname}?${query}`;
}

on("lcp-fast", () => reloadScenario("slow-lcp", 250));
on("lcp-slow", () => reloadScenario("slow-lcp", 1_800));
on("fcp-slow", () => reloadScenario("blocked-fcp"));

// 清空面板
on("clear", () => {
  panel.replaceChildren();
});
