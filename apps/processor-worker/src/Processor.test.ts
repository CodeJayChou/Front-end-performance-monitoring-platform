import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config";
import { EventProcessor, type ProcessorStore } from "./Processor";
import type { ClaimedEvent } from "./types";

const event: ClaimedEvent = {
  id: "1",
  projectId: "demo-project",
  eventId: "event-1",
  type: "error",
  eventTimestamp: new Date(),
  environment: "test",
  release: null,
  platform: "web",
  payload: { kind: "js", message: "boom" },
  processingAttempts: 1,
};

describe("EventProcessor", () => {
  it("claims and completes events", async () => {
    const repository: ProcessorStore = {
      claimBatch: vi.fn().mockResolvedValue([event]),
      complete: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    };
    const processor = new EventProcessor(loadConfig({}), repository);

    expect(await processor.runOnce()).toBe(1);
    expect(repository.complete).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ type: "error", kind: "js" }),
    );
  });

  it("records an isolated failure and continues", async () => {
    const repository: ProcessorStore = {
      claimBatch: vi.fn().mockResolvedValue([event]),
      complete: vi.fn().mockRejectedValue(new Error("database unavailable")),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    };
    const processor = new EventProcessor(loadConfig({}), repository);

    expect(await processor.runOnce()).toBe(1);
    expect(repository.recordFailure).toHaveBeenCalledWith(
      event,
      expect.any(Error),
      5,
    );
  });
});
