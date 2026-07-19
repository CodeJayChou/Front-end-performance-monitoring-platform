import { describe, expect, it } from "vitest";
import { filtersFromSearch, filtersToSearch, toApiFilters } from "./filters";

describe("dashboard filters", () => {
  it("creates a bounded API time range", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const result = toApiFilters({ range: "7d", environment: "production", release: "", platform: "web" }, now);
    expect(result).toEqual({
      from: "2026-07-12T12:00:00.000Z",
      to: "2026-07-19T12:00:00.000Z",
      environment: "production",
      release: undefined,
      platform: "web",
    });
  });

  it("round-trips non-default filters through URL search params", () => {
    const filters = { range: "30d" as const, environment: "development", release: "1.2.0", platform: "web" };
    const search = filtersToSearch(filters, new URLSearchParams("unrelated=kept"));
    expect(search.get("unrelated")).toBe("kept");
    expect(filtersFromSearch(search)).toEqual(filters);
  });
});
