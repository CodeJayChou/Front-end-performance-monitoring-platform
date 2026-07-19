import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "./client";

const client = new QueryClient({
  baseUrl: "http://localhost:3002/",
  projectId: "demo project",
  adminKey: "secret-key",
});

afterEach(() => vi.unstubAllGlobals());

describe("QueryClient", () => {
  it("serializes filters, sends the bearer key and normalizes overview numbers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      total_events: "12",
      error_events: "2",
      sessions: "5",
      failed_events: "1",
      vitals: [{ metric: "LCP", sample_count: "3", average: "1250", good: "2", needs_improvement: "1", poor: "0" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client.overview({
      from: "2026-07-18T00:00:00.000Z",
      to: "2026-07-19T00:00:00.000Z",
      environment: "production",
    });

    expect(result).toMatchObject({ totalEvents: 12, errorEvents: 2, sessions: 5 });
    expect(result.vitals[0]).toMatchObject({ metric: "LCP", average: 1250, sampleCount: 3 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/projects/demo%20project/overview?");
    expect(url).toContain("environment=production");
    expect(init.headers).toEqual({ Authorization: "Bearer secret-key" });
  });

  it("turns unauthorized responses into an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )));
    await expect(client.events({ from: "a", to: "b" })).rejects.toEqual(
      expect.objectContaining({ status: 401, message: "unauthorized" }),
    );
  });
});
