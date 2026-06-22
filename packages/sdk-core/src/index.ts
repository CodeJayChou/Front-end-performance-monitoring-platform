/**
 * @monitor/sdk-core — SDK 核心（最小骨架）
 * 目前只把流程跑通：init 仅打印日志，不实现任何监控业务。
 */
import type { MonitorConfig } from "@monitor/types";

export class MonitorSDK {
  init(config: MonitorConfig = {}): void {
    console.log("monitor init", config);
  }
}

const monitor = new MonitorSDK();
export default monitor;
