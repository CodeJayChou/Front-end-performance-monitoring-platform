import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "./config";

const apps: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function dependencies(authorized = true) {
  return {
    adminRepository: { authorize: vi.fn().mockResolvedValue(authorized) },
    queryRepository: {
      overview: vi.fn().mockResolvedValue({ total_events: "3" }),
      performanceSeries: vi.fn().mockResolvedValue([]),
      errors: vi.fn().mockResolvedValue({ total: "0", items: [] }),
      errorDetail: vi.fn().mockResolvedValue(null),
      events: vi.fn().mockResolvedValue({ total: "0", items: [] }),
      releases: vi.fn().mockResolvedValue([]),
    },
  };
}

describe("query service", () => {
  it("requires a project-scoped admin bearer key", async () => {
    const deps = dependencies();
    const app = createApp(loadConfig({}), deps);
    apps.push(app);

    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo-project/overview",
    });
    expect(missing.statusCode).toBe(401);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo-project/overview",
      headers: { authorization: "Bearer demo-admin-key" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total_events: "3" });
    expect(deps.adminRepository.authorize).toHaveBeenCalledWith(
      "demo-project",
      "demo-admin-key",
    );
  });

  it("validates query ranges and returns missing groups as 404", async () => {
    const deps = dependencies();
    const app = createApp(loadConfig({}), deps);
    apps.push(app);
    const headers = { authorization: "Bearer demo-admin-key" };

    const invalid = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo-project/events?limit=999",
      headers,
    });
    expect(invalid.statusCode).toBe(400);

    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/projects/demo-project/errors/unknown",
      headers,
    });
    expect(missing.statusCode).toBe(404);
  });
});
