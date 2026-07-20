import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { SourceMapSymbolicator } from "./symbolicate";
import type { ClaimedEvent } from "./types";

const event: ClaimedEvent = {
  id: "1",
  projectId: "demo-project",
  eventId: "event-1",
  type: "error",
  eventTimestamp: new Date(),
  environment: "production",
  release: "web@1.0.0",
  platform: "web",
  context: {},
  payload: {
    kind: "js",
    message: "boom",
    stackFrames: [{ file: "https://cdn.example.com/assets/app.js", line: 1, col: 1 }],
  },
  processingAttempts: 1,
};

describe("SourceMapSymbolicator", () => {
  it("maps generated frames back to source lines", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: "1",
        artifact_name: "assets/app.js",
        source_map: {
          version: 3,
          names: ["run"],
          sources: ["src/app.ts"],
          sourcesContent: ["throw new Error('boom');"],
          mappings: "AAAAA",
        },
      }],
    });
    const symbolicator = new SourceMapSymbolicator({ query } as unknown as Pool);

    await expect(symbolicator.symbolicate(event)).resolves.toEqual({
      status: "symbolicated",
      stack: [expect.objectContaining({
        originalFile: "src/app.ts",
        originalLine: 1,
        originalCol: 1,
        originalFunctionName: "run",
        sourceLine: "throw new Error('boom');",
        inApp: true,
      })],
    });
    expect(query.mock.calls[0]![1]).toEqual([
      "demo-project",
      "web@1.0.0",
      "assets/app.js",
    ]);
  });

  it("does not block errors without matching artifacts", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const symbolicator = new SourceMapSymbolicator({ query } as unknown as Pool);
    await expect(symbolicator.symbolicate(event)).resolves.toEqual({
      status: "map_not_found",
      stack: null,
    });
  });
});
