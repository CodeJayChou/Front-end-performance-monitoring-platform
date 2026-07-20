export type ErrorIssueStatus = "unresolved" | "in_progress" | "resolved" | "ignored";

export interface ErrorIssueUpdate {
  status: ErrorIssueStatus;
  note: string | null;
}

export function parseErrorIssueUpdate(
  value: unknown,
): { ok: true; value: ErrorIssueUpdate } | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "invalid_error_issue_update" };
  }
  const body = value as Record<string, unknown>;
  if (!isStatus(body.status)) return { ok: false, reason: "invalid_error_status" };
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
    return { ok: false, reason: "invalid_error_note" };
  }
  const note = typeof body.note === "string" ? body.note.trim() : null;
  if (note && note.length > 2_000) return { ok: false, reason: "error_note_too_long" };
  return { ok: true, value: { status: body.status, note: note || null } };
}

function isStatus(value: unknown): value is ErrorIssueStatus {
  return value === "unresolved" || value === "in_progress" || value === "resolved" || value === "ignored";
}
