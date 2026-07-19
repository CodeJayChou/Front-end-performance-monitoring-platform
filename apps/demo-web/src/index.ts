import { initWebSDK } from "@monitor/sdk-web";
import { createEvent } from "@monitor/event-contract";

// 最终用户视角：一行初始化，按需配置采样率 / beforeSend
const client = initWebSDK({
  // Keep the Node demo on the same real ingest path as the browser demo.
  dsn: "http://localhost:3001/api/v1/events/batch",
  projectId: "demo-project",
  sdkKey: "demo-public-key",
  environment: "development",
  release: "demo-web@0.1.0",
  sampleRate: 1, // 全量上报
  beforeSend(event) {
    // 这里可做：过滤敏感数据 / 采样 / 返回 null 丢弃事件
    return event;
  },
});

// 写入上下文：capture 时由 Scope.applyToEvent 注入进每个事件（pipeline 之前）
client.scope.setUser({ id: "u_1001" }).setRoute("/home");
client.scope.addBreadcrumb("page load");

console.log("[demo] SDK initialized", client.platform);

// 验证整条链路：
// - 浏览器环境：抛出未捕获错误，由 GlobalError 插件经 window.onerror 自动捕获
// - Node/dev 环境：无 window，直接 capture 一条 error 事件，避免进程崩溃
const isBrowser = typeof (globalThis as { window?: unknown }).window !== "undefined";
if (isBrowser) {
  throw new Error("test error");
} else {
  await client.capture(
    createEvent(
      "error",
      { kind: "js", message: "test error" },
      client.platform,
    ),
  );
  // The Node process exits immediately; flush explicitly because the SDK's
  // browser-oriented timer is intentionally unref'ed in Node.
  await client.flush();
}
