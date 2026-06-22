/**
 * @monitor/sdk-performance — 性能采集插件（骨架）。
 */
import type { MonitorPlugin } from "@monitor/shared";

export const PerformancePlugin: MonitorPlugin = {
  name: "performance",
  setup(_ctx) {
    // TODO: 采集 Web Vitals（LCP / CLS / INP ...）与导航/资源 timing，
    //       通过 _ctx.bus.emit("perf:*", payload) 投递。
  },
};

export default PerformancePlugin;
