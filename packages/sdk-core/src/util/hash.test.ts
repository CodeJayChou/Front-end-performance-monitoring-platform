import { describe, expect, it } from "vitest";
import { fnv1a } from "./hash";

describe("fnv1a", () => {
  it("同一输入恒定（确定性）", () => {
    expect(fnv1a("error|js|boom")).toBe(fnv1a("error|js|boom"));
  });

  it("不同输入产生不同哈希", () => {
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
    expect(fnv1a("error|js|boom")).not.toBe(fnv1a("error|js|crash"));
  });

  it("空串也有稳定输出（FNV offset basis）", () => {
    expect(fnv1a("")).toBe((0x811c9dc5 >>> 0).toString(36));
  });

  it("输出为 base36 字符串", () => {
    expect(fnv1a("hello world")).toMatch(/^[0-9a-z]+$/);
  });

  it("对长输入不溢出为 NaN/Infinity（Math.imul 保 32 位）", () => {
    const long = "x".repeat(10_000);
    expect(fnv1a(long)).toMatch(/^[0-9a-z]+$/);
  });
});
