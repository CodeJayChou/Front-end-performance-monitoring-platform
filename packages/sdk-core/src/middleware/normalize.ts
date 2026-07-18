import type { BaseEvent, EventRuntime } from "@monitor/event-contract";
import { defaultRuntime } from "@monitor/event-contract";

export interface NormalizeMetadata {
  schemaVersion?: string;
  projectId?: string;
  sessionId?: string;
  sdk?: { name: string; version: string };
  environment?: string;
  release?: string;
}

/**
 * normalize —— pipeline 第一步。
 * 保证事件具备最小完整结构：补齐 timestamp / platform / context，
 * 使后续阶段（enrich / filter / sample）可以安全地依赖这些字段。
 *
 * 时间戳兜底走注入的 runtime，不再硬编码 `Date.now()`。
 */
export function normalize(
  event: BaseEvent,
  platform = "web",
  runtime: EventRuntime = defaultRuntime,
  metadata: NormalizeMetadata = {},
): BaseEvent {
  return {
    ...event,
    schemaVersion: event.schemaVersion ?? metadata.schemaVersion ?? "1.0",
    timestamp: event.timestamp || runtime.now(),
    platform: event.platform || platform,
    projectId: event.projectId ?? metadata.projectId,
    sessionId: event.sessionId ?? metadata.sessionId,
    sdk: event.sdk ?? metadata.sdk,
    environment: event.environment ?? metadata.environment ?? "development",
    release: event.release ?? metadata.release,
    context: event.context ?? {},
  };
}
