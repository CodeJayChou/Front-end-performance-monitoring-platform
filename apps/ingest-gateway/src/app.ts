import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { Pool } from "pg";
import type { GatewayConfig } from "./config";
import { EventRepository } from "./repository/EventRepository";
import { ProjectRepository } from "./repository/ProjectRepository";
import { validateBatchEnvelope, validateEventForProject } from "./validation";
import type { EventBatchRequest } from "./types";
import { InMemoryRateLimiter } from "./rateLimit";

export interface AppDependencies {
  pool?: Pool;
  eventRepository?: Pick<EventRepository, "insertBatch">;
  projectRepository?: Pick<ProjectRepository, "authorize">;
}

export function createApp(config: GatewayConfig, dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: config.bodyLimit });
  const pool = dependencies.pool ?? new Pool({ connectionString: config.databaseUrl });
  const eventRepository = dependencies.eventRepository ?? new EventRepository(pool);
  const projectRepository = dependencies.projectRepository ?? new ProjectRepository(pool);
  const rateLimiter = new InMemoryRateLimiter(config.rateLimitPerMinute);

  void app.register(cors, { origin: true, methods: ["POST", "OPTIONS"] });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  app.post<{ Body: EventBatchRequest }>("/api/v1/events/batch", async (request, reply) => {
    const envelope = validateBatchEnvelope(request.body, config);
    if (!envelope.ok) return reply.code(envelope.reason === "batch_too_large" ? 413 : 400).send({ error: envelope.reason });

    if (!rateLimiter.allow(`${request.ip}:${envelope.projectId}`)) {
      return reply.code(429).send({ error: "rate_limited" });
    }

    const project = await projectRepository.authorize(envelope.projectId, envelope.sdkKey);
    if (!project) return reply.code(401).send({ error: "invalid_project_key" });

    const origin = request.headers.origin;
    if (origin && project.allowedOrigins.length > 0 && !project.allowedOrigins.includes(origin)) {
      return reply.code(403).send({ error: "origin_not_allowed" });
    }

    const validEvents = [];
    const rejections = [];
    for (const raw of envelope.events) {
      const result = validateEventForProject(raw, envelope.projectId, config);
      if (result.ok) validEvents.push(result.event);
      else rejections.push(result.rejection);
    }

    let accepted = 0;
    if (validEvents.length > 0) accepted = await eventRepository.insertBatch(validEvents);
    return reply.code(202).send({
      accepted,
      rejected: rejections.length,
      rejections,
    });
  });

  app.addHook("onClose", async () => {
    if (!dependencies.pool) await pool.end();
  });

  return app;
}
