import type { Client } from "../client/Client";

/**
 * 插件标准接口。任何能力（error / performance / replay …）都通过实现它接入。
 * Core 只认识这个接口，不认识具体能力。
 */
export interface Integration {
  /** 插件名称，便于调试与去重 */
  name: string;
  /** 注册到 Client 时调用，在此安装 runtime hooks */
  setup(client: Client): void;
}
