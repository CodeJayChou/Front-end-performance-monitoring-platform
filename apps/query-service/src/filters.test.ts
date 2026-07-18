import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";
import { parseFilters } from "./filters";

describe("query filters", () => {
  it("applies defaults and bounded pagination", () => {
    const now = new Date("2026-01-02T00:00:00.000Z");
    const result = parseFilters({}, loadConfig({}), now);
    expect(result.ok && result.filters).toMatchObject({ limit: 50, offset: 0, to: now });
  });

  it("rejects oversized ranges and invalid pagination", () => {
    const config = loadConfig({});
    expect(
      parseFilters({ from: "2020-01-01", to: "2021-01-01" }, config),
    ).toEqual({ ok: false, reason: "time_range_too_large" });
    expect(parseFilters({ limit: "999" }, config)).toEqual({
      ok: false,
      reason: "invalid_pagination",
    });
  });
});
