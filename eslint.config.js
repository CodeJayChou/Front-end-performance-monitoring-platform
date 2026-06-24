// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Phase 1 — 冻结废弃抽象：禁止重新引入已删除的空壳包。
  {
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@monitor/types",
              message:
                "已废弃（包已删除）：类型请从 @monitor/event-contract 导入。",
            },
            {
              name: "@monitor/transport",
              message:
                "已废弃（包已删除）：Transport 在 @monitor/sdk-core/transport。",
            },
          ],
        },
      ],
    },
  },

  // Phase 10.2 — 依赖边界：只有 Client 负责编排，分层不得相互穿透。
  // transport 层（IO）不得依赖 middleware。
  {
    files: ["packages/*/src/transport/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/middleware/**"],
              message: "transport 层不得依赖 middleware：事件编排只属于 Client。",
            },
          ],
        },
      ],
    },
  },
  // middleware 层不得依赖 transport。
  {
    files: ["packages/*/src/middleware/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/transport/**"],
              message: "middleware 不得依赖 transport：发送由 Client 在链路末端完成。",
            },
          ],
        },
      ],
    },
  },
  // integration 层不得直接操作 transport，事件一律经 Client.capture。
  {
    files: ["packages/*/src/integration/**", "packages/*/src/integrations/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/transport/**"],
              message:
                "integration 不得直接依赖 transport：采集只能调用 client.capture()。",
            },
          ],
        },
      ],
    },
  },

  // 测试文件放宽：允许直接 import 内部模块做白盒测试。
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
