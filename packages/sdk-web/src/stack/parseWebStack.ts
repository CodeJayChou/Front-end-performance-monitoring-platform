import type { StackFrame } from "@monitor/event-contract";

/**
 * 解析浏览器错误栈为统一 StackFrame[]。
 *
 * 覆盖三种主流格式，逐行匹配，命中即结构化、未命中保留 `raw`（不丢信息）：
 *  - V8/Chrome 具名帧：`at fn (file:line:col)`
 *  - V8/Chrome 匿名帧：`at file:line:col`
 *  - Firefox/Safari：   `fn@file:line:col`
 *
 * V8 栈首行常是 `Error: message`，不匹配任何帧式，自然落入 `raw`——
 * 对去重/展示无害（指纹不依赖栈帧，见 dedup.fingerprint）。
 */
const CHROME_NAMED = /^at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/;
const CHROME_ANON = /^at\s+(.+?):(\d+):(\d+)$/;
const FIREFOX_SAFARI = /^(.*?)@(.+?):(\d+):(\d+)$/;

function parseLine(line: string): StackFrame {
  let m = CHROME_NAMED.exec(line);
  if (m) {
    return { functionName: m[1], file: m[2], line: Number(m[3]), col: Number(m[4]), raw: line };
  }
  m = CHROME_ANON.exec(line);
  if (m) {
    return { file: m[1], line: Number(m[2]), col: Number(m[3]), raw: line };
  }
  m = FIREFOX_SAFARI.exec(line);
  if (m) {
    return {
      functionName: m[1] || undefined,
      file: m[2],
      line: Number(m[3]),
      col: Number(m[4]),
      raw: line,
    };
  }
  return { raw: line };
}

export function parseWebStack(stack?: string): StackFrame[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseLine);
}
