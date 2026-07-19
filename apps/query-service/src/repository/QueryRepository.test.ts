import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { QueryRepository } from "./QueryRepository";

describe("QueryRepository performance buckets", () => {
  it("includes the partial first minute when from has seconds", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new QueryRepository({ query } as unknown as Pool);
    const from = new Date("2026-07-19T13:10:37.000Z");
    const to = new Date("2026-07-19T13:20:37.000Z");

    await repository.performanceSeries("demo-project", {
      from,
      to,
      limit: 50,
      offset: 0,
    });

    const [sql, values] = query.mock.calls[0]! as [string, unknown[]];
    expect(sql).toContain(
      "bucket_start >= date_trunc('minute', $2::timestamptz)",
    );
    expect(values).toEqual(["demo-project", from, to]);
  });

  it("merges processed raw-event P75 into every minute bucket", async () => {
    const bucketStart = new Date("2026-07-19T13:10:00.000Z");
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          bucket_start: bucketStart,
          metric: "FCP",
          rating: "good",
          sample_count: "4",
          average: 1200,
          minimum: 1000,
          maximum: 1500,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ bucket_start: bucketStart, metric: "FCP", p75: 1400 }],
      });
    const repository = new QueryRepository({ query } as unknown as Pool);

    const result = await repository.performanceSeries("demo-project", {
      from: new Date("2026-07-19T13:10:37.000Z"),
      to: new Date("2026-07-19T13:20:37.000Z"),
      limit: 50,
      offset: 0,
    }, "FCP") as Array<Record<string, unknown>>;

    expect(result[0]).toMatchObject({ metric: "FCP", p75: 1400 });
    expect(query.mock.calls[1]![0]).toContain("percentile_cont(0.75)");
    expect(query.mock.calls[1]![1]).toEqual([
      "demo-project",
      new Date("2026-07-19T13:10:37.000Z"),
      new Date("2026-07-19T13:20:37.000Z"),
      "FCP",
    ]);
  });
});
