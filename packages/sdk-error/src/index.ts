/**
 * @monitor/sdk-error — 错误采集插件（骨架）。
 */
import type { MonitorPlugin } from "@monitor/shared";

export const ErrorPlugin: MonitorPlugin = {
  name: "error",
  setup(_ctx) {
    // TODO: 监听 window.onerror / unhandledrejection / 资源加载错误，
    //       规范化后通过 _ctx.bus.emit("error", payload) 投递。
  },
};

export default ErrorPlugin;
