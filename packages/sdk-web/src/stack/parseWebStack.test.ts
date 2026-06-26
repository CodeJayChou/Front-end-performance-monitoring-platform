import { describe, expect, it } from "vitest";
import { parseWebStack } from "./parseWebStack";

describe("parseWebStack", () => {
  it("空栈返回空数组", () => {
    expect(parseWebStack()).toEqual([]);
    expect(parseWebStack("")).toEqual([]);
  });

  it("解析 V8 具名帧：at fn (file:line:col)", () => {
    const frames = parseWebStack("at foo (https://a.com/app.js:10:5)");
    expect(frames[0]).toEqual({
      functionName: "foo",
      file: "https://a.com/app.js",
      line: 10,
      col: 5,
      raw: "at foo (https://a.com/app.js:10:5)",
    });
  });

  it("解析 V8 匿名帧：at file:line:col", () => {
    const frames = parseWebStack("at https://a.com/app.js:10:5");
    expect(frames[0]).toMatchObject({
      file: "https://a.com/app.js",
      line: 10,
      col: 5,
    });
    expect(frames[0]!.functionName).toBeUndefined();
  });

  it("解析 Firefox/Safari 帧：fn@file:line:col", () => {
    const frames = parseWebStack("bar@https://a.com/app.js:20:8");
    expect(frames[0]).toMatchObject({
      functionName: "bar",
      file: "https://a.com/app.js",
      line: 20,
      col: 8,
    });
  });

  it("无法识别的行保留 raw", () => {
    const frames = parseWebStack("Error: boom");
    expect(frames[0]).toEqual({ raw: "Error: boom" });
  });

  it("多行栈逐行解析，跳过空行", () => {
    const stack = [
      "Error: boom",
      "    at foo (https://a.com/app.js:10:5)",
      "",
      "    at bar (https://a.com/app.js:20:8)",
    ].join("\n");
    const frames = parseWebStack(stack);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual({ raw: "Error: boom" });
    expect(frames[1]!.functionName).toBe("foo");
    expect(frames[2]!.functionName).toBe("bar");
  });
});
