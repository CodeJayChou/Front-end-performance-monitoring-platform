/**
 * @monitor/sdk-replay — 会话录制插件（骨架）。
 */
import type { MonitorPlugin } from "@monitor/shared";

export const ReplayPlugin: MonitorPlugin = {
  name: "replay",
  setup(_ctx) {
    // TODO: 录制 DOM 变更与用户交互（增量快照），
    //       通过 _ctx.bus.emit("replay:*", payload) 投递。
  },
};

export default ReplayPlugin;
