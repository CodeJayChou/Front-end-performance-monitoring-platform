import { afterEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "@monitor/event-contract";
import { createApp } from "./app";
import { loadConfig } from "./config";

const apps: Array<ReturnType<typeof createApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("ingest gateway", () => {
  it("鉴权、校验并以 202 接受有效批次", async () => {
    const event = createEvent("custom", { ok: true }, {
      projectId: "demo-project",
      sessionId: "session-1",
      platform: "web",
      environment: "test",
      sdk: { name: "test-sdk", version: "1.0.0" },
    });
    const eventRepository = { insertBatch: vi.fn().mockResolvedValue(1) };
    const projectRepository = {
      authorize: vi.fn().mockResolvedValue({
        id: "demo-project",
        allowedOrigins: ["http://localhost:5173"],
      }),
    };
    const app = createApp(loadConfig({}), { eventRepository, projectRepository });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events/batch",
      headers: { origin: "http://localhost:5173" },
      payload: {
        projectId: "demo-project",
        sdkKey: "demo-public-key",
        events: [event],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ accepted: 1, rejected: 0 });
    expect(eventRepository.insertBatch).toHaveBeenCalledTimes(1);
  });

  it("拒绝未授权来源和无效 key", async () => {
    const projectRepository = {
      authorize: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: "demo-project",
        allowedOrigins: ["https://allowed.example"],
      }),
    };
    const app = createApp(loadConfig({}), {
      eventRepository: { insertBatch: vi.fn().mockResolvedValue(0) },
      projectRepository,
    });
    apps.push(app);

    const payload = { projectId: "demo-project", sdkKey: "bad", events: [{}] };
    expect((await app.inject({ method: "POST", url: "/api/v1/events/batch", payload })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/events/batch",
          headers: { origin: "https://blocked.example" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
  });

  it("accepts JSON sent as text/plain by sendBeacon", async () => {
    const event = createEvent("custom", { source: "beacon" }, {
      projectId: "demo-project",
      sessionId: "beacon-session",
      platform: "web",
      environment: "test",
      sdk: { name: "test-sdk", version: "1.0.0" },
    });
    const eventRepository = { insertBatch: vi.fn().mockResolvedValue(1) };
    const projectRepository = {
      authorize: vi.fn().mockResolvedValue({ id: "demo-project", allowedOrigins: [] }),
    };
    const app = createApp(loadConfig({}), { eventRepository, projectRepository });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/events/batch",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      payload: JSON.stringify({
        projectId: "demo-project",
        sdkKey: "demo-public-key",
        events: [event],
      }),
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ accepted: 1, rejected: 0 });
  });
});
