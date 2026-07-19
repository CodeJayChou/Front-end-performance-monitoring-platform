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
});
