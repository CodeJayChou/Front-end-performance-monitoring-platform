import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { ProcessorRepository } from "./repository";
import type { ClaimedEvent, SymbolicatedFrame } from "./types";

describe("ProcessorRepository", () => {
  it("serializes symbolicated frames before writing the jsonb column", async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO error_issues")) return { rowCount: 1, rows: [] };
      if (sql.includes("SELECT status, resolved_at")) {
        return { rowCount: 1, rows: [{ status: "unresolved", resolved_at: null }] };
      }
      return { rowCount: 1, rows: [] };
    });
    const client = { query, release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const repository = new ProcessorRepository(pool);
    const event: ClaimedEvent = {
      id: "1",
      projectId: "demo-project",
      eventId: "event-1",
      type: "error",
      eventTimestamp: new Date("2026-07-20T08:00:00.000Z"),
      environment: "development",
      release: "demo@1.0.0",
      platform: "web",
      context: {},
      payload: {},
      processingAttempts: 1,
    };
    const stack: SymbolicatedFrame[] = [{
      file: "https://example.test/app.min.js",
      line: 1,
      col: 1,
      originalFile: "src/app.ts",
      originalLine: 4,
      originalCol: 3,
      inApp: true,
    }];

    await repository.complete(
      event,
      { type: "error", fingerprint: "fingerprint", kind: "js", title: "boom", culprit: null },
      { status: "symbolicated", stack },
    );

    const update = query.mock.calls.find(([sql]) => String(sql).includes("UPDATE events"));
    expect(update).toBeDefined();
    expect(typeof update?.[1]?.[3]).toBe("string");
    expect(JSON.parse(update?.[1]?.[3] as string)).toEqual(stack);
  });
});
