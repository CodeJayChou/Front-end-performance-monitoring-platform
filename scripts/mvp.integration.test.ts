import { randomUUID } from "node:crypto";
import { createEvent } from "@monitor/event-contract";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp as createGateway } from "../apps/ingest-gateway/src/app";
import { loadConfig as loadGatewayConfig } from "../apps/ingest-gateway/src/config";
import { EventProcessor } from "../apps/processor-worker/src/Processor";
import { loadConfig as loadProcessorConfig } from "../apps/processor-worker/src/config";
import { ProcessorRepository } from "../apps/processor-worker/src/repository";
import { createApp as createQueryService } from "../apps/query-service/src/app";
import { loadConfig as loadQueryConfig } from "../apps/query-service/src/config";

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run("MVP PostgreSQL integration", () => {
  const suffix = randomUUID();
  const projectId = `integration-${suffix}`;
  const sdkKey = `sdk-${suffix}`;
  const adminKey = `admin-${suffix}`;
  const pool = new Pool({ connectionString: databaseUrl });
  const gateway = createGateway(loadGatewayConfig({ DATABASE_URL: databaseUrl }), { pool });
  const queryService = createQueryService(loadQueryConfig({ DATABASE_URL: databaseUrl }), { pool });
  const processor = new EventProcessor(
    loadProcessorConfig({ DATABASE_URL: databaseUrl, PROCESSOR_BATCH_SIZE: "1000" }),
    new ProcessorRepository(pool),
  );

  beforeAll(async () => {
    await pool.query(
      "INSERT INTO projects (id, name, allowed_origins) VALUES ($1, $2, $3)",
      [projectId, "Integration project", JSON.stringify(["https://test.example"])],
    );
    await pool.query(
      "INSERT INTO project_keys (project_id, public_key) VALUES ($1, $2)",
      [projectId, sdkKey],
    );
    await pool.query(
      "INSERT INTO project_admin_keys (project_id, admin_key) VALUES ($1, $2)",
      [projectId, adminKey],
    );
  });

  afterAll(async () => {
    await gateway.close();
    await queryService.close();
    await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
    await pool.end();
  });

  it("ingests, deduplicates, processes and queries events", async () => {
    const metadata = {
      projectId,
      sessionId: `session-${suffix}`,
      platform: "web",
      environment: "integration",
      release: "1.0.0",
      sdk: { name: "integration-sdk", version: "1.0.0" },
    };
    const error = createEvent(
      "error",
      {
        kind: "js",
        message: "Checkout 123 failed",
        stackFrames: [{ file: "app.js", line: 5 }],
      },
      metadata,
    );
    const metric = createEvent(
      "performance",
      { metric: "LCP", value: 1_200, rating: "good" },
      metadata,
    );
    const payload = { projectId, sdkKey, events: [error, metric] };

    const accepted = await gateway.inject({
      method: "POST",
      url: "/api/v1/events/batch",
      headers: { origin: "https://test.example" },
      payload,
    });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toMatchObject({ accepted: 2, rejected: 0 });

    const duplicate = await gateway.inject({
      method: "POST",
      url: "/api/v1/events/batch",
      headers: { origin: "https://test.example" },
      payload,
    });
    expect(duplicate.json()).toMatchObject({ accepted: 0, rejected: 0 });
    expect(await processor.runOnce()).toBeGreaterThanOrEqual(2);

    const headers = { authorization: `Bearer ${adminKey}` };
    const overview = await queryService.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/overview?environment=integration`,
      headers,
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({
      total_events: "2",
      error_events: "1",
      sessions: "1",
      vitals: [expect.objectContaining({ metric: "LCP", sample_count: "1" })],
    });

    const errors = await queryService.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/errors?environment=integration`,
      headers,
    });
    expect(errors.json()).toMatchObject({ total: "1", items: [expect.any(Object)] });

    const series = await queryService.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/performance/series?metric=LCP`,
      headers,
    });
    expect(series.json()).toMatchObject({
      items: [expect.objectContaining({ metric: "LCP" })],
    });
  });
});
