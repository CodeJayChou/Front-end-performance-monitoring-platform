import { describe, expect, it } from "vitest";
import { createEvent } from "@monitor/event-contract";
import { loadConfig } from "./config";
import { validateBatchEnvelope, validateEventForProject } from "./validation";

const config = loadConfig({});

describe("ingest validation", () => {
  it("接受 v1 项目事件并拒绝跨项目事件", () => {
    const event = createEvent("custom", { ok: true }, {
      platform: "web",
      projectId: "p1",
      sessionId: "s1",
      sdk: { name: "test", version: "1.0.0" },
      environment: "test",
    });

    expect(validateEventForProject(event, "p1", config).ok).toBe(true);
    expect(validateEventForProject({ ...event, projectId: "p2" }, "p1", config)).toMatchObject({
      ok: false,
      rejection: { reason: "project_id_mismatch" },
    });
  });

  it("限制 batch 结构和数量", () => {
    expect(validateBatchEnvelope({}, config)).toMatchObject({ ok: false, reason: "missing_project_id" });
    expect(validateBatchEnvelope({ projectId: "p1", sdkKey: "k", events: [] }, config)).toMatchObject({
      ok: false,
      reason: "events_must_be_non_empty_array",
    });
  });
});
