import { validateEvent, type BaseEvent } from "@monitor/event-contract";
import type { GatewayConfig } from "./config";
import type { Rejection, ValidatedEvent } from "./types";

export function validateBatchEnvelope(
  body: unknown,
  config: GatewayConfig,
): { ok: true; projectId: string; sdkKey: string; events: unknown[] } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid_request" };
  const value = body as Record<string, unknown>;
  if (typeof value.projectId !== "string" || value.projectId.length === 0) {
    return { ok: false, reason: "missing_project_id" };
  }
  if (typeof value.sdkKey !== "string" || value.sdkKey.length === 0) {
    return { ok: false, reason: "missing_sdk_key" };
  }
  if (!Array.isArray(value.events) || value.events.length === 0) {
    return { ok: false, reason: "events_must_be_non_empty_array" };
  }
  if (value.events.length > config.maxBatchSize) {
    return { ok: false, reason: "batch_too_large" };
  }
  return { ok: true, projectId: value.projectId, sdkKey: value.sdkKey, events: value.events };
}

export function validateEventForProject(
  raw: unknown,
  projectId: string,
  config: GatewayConfig,
): { ok: true; event: ValidatedEvent } | { ok: false; rejection: Rejection } {
  const id = getEventId(raw);
  if (!validateEvent(raw)) return { ok: false, rejection: { id, reason: "invalid_event" } };

  let size: number;
  try {
    size = Buffer.byteLength(JSON.stringify(raw), "utf8");
  } catch {
    return { ok: false, rejection: { id, reason: "event_not_serializable" } };
  }
  if (size > config.maxEventBytes) {
    return { ok: false, rejection: { id, reason: "event_too_large" } };
  }

  const event = raw as BaseEvent;
  if (event.schemaVersion !== "1.0") {
    return { ok: false, rejection: { id, reason: "unsupported_schema" } };
  }
  if (event.projectId !== projectId) {
    return { ok: false, rejection: { id, reason: "project_id_mismatch" } };
  }
  if (typeof event.sessionId !== "string" || event.sessionId.length === 0) {
    return { ok: false, rejection: { id, reason: "missing_session_id" } };
  }
  if (!Number.isFinite(event.timestamp) || event.timestamp <= 0) {
    return { ok: false, rejection: { id, reason: "invalid_timestamp" } };
  }
  if (typeof event.platform !== "string" || event.platform.length === 0) {
    return { ok: false, rejection: { id, reason: "missing_platform" } };
  }
  if (typeof event.environment !== "string" || event.environment.length === 0) {
    return { ok: false, rejection: { id, reason: "missing_environment" } };
  }
  if (
    !event.sdk ||
    typeof event.sdk.name !== "string" ||
    event.sdk.name.length === 0 ||
    typeof event.sdk.version !== "string" ||
    event.sdk.version.length === 0
  ) {
    return { ok: false, rejection: { id, reason: "invalid_sdk" } };
  }
  if (!event.context || typeof event.context !== "object" || Array.isArray(event.context)) {
    return { ok: false, rejection: { id, reason: "invalid_context" } };
  }

  return {
    ok: true,
    event: event as ValidatedEvent,
  };
}

function getEventId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" ? id : undefined;
}
