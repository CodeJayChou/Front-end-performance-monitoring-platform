import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 把 @monitor/* 指向各包的 src，测试无需先 build，直接跑源码。
// 仓库路径含空格，必须用 fileURLToPath 正确解码。
const fromRoot = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@monitor/event-contract": fromRoot("./packages/event-contract/src/index.ts"),
      "@monitor/sdk-core": fromRoot("./packages/sdk-core/src/index.ts"),
      "@monitor/sdk-web": fromRoot("./packages/sdk-web/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "scripts/**/*.test.ts",
    ],
  },
});
