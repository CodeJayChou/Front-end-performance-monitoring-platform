/**
 * demo-app — 验证插件化装配流程能跑通。
 */
import monitor from "@monitor/sdk-core";
import { ErrorPlugin } from "@monitor/sdk-error";
import { PerformancePlugin } from "@monitor/sdk-performance";
import { ReplayPlugin } from "@monitor/sdk-replay";

monitor
  .use(ErrorPlugin)
  .use(PerformancePlugin)
  .use(ReplayPlugin)
  .init({ appId: "demo-app" });
