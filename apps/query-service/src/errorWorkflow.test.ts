import { describe, expect, it } from "vitest";
import { parseErrorIssueUpdate } from "./errorWorkflow";

describe("error issue validation", () => {
  it("accepts supported states and trims notes", () => {
    expect(parseErrorIssueUpdate({ status: "resolved", note: " fixed " })).toEqual({
      ok: true,
      value: { status: "resolved", note: "fixed" },
    });
  });

  it("rejects unknown states", () => {
    expect(parseErrorIssueUpdate({ status: "closed" })).toEqual({
      ok: false,
      reason: "invalid_error_status",
    });
  });
});
