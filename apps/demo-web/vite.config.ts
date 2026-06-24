import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// 把 @monitor/* 直接指向各包 src，浏览器 demo 无需先 build；
// 改 SDK 源码即时热更新。仓库路径含空格，必须用 fileURLToPath 解码。
const fromRoot = (p: string): string =>
  fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@monitor/event-contract": fromRoot(
        "../../packages/event-contract/src/index.ts",
      ),
      "@monitor/sdk-core": fromRoot("../../packages/sdk-core/src/index.ts"),
      "@monitor/sdk-web": fromRoot("../../packages/sdk-web/src/index.ts"),
    },
  },
});
