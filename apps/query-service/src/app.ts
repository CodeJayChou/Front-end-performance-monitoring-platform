import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { Pool } from "pg";
import type { QueryConfig } from "./config";
import { parseFilters } from "./filters";
import { AdminProjectRepository } from "./repository/AdminProjectRepository";
import { QueryRepository } from "./repository/QueryRepository";

interface RouteParams {
  projectId: string;
  fingerprint?: string;
}

type RouteQuery = Record<string, string | undefined>;

export interface QueryAppDependencies {
  pool?: Pool;
  adminRepository?: Pick<AdminProjectRepository, "authorize">;
  queryRepository?: Pick<
    QueryRepository,
    "overview" | "performanceSeries" | "errors" | "errorDetail" | "events" | "releases"
  >;
}

export function createApp(
  config: QueryConfig,
  dependencies: QueryAppDependencies = {},
): FastifyInstance {
  const app = Fastify({ logger: true });
  const pool = dependencies.pool ?? new Pool({ connectionString: config.databaseUrl });
  const adminRepository = dependencies.adminRepository ?? new AdminProjectRepository(pool);
  const queryRepository = dependencies.queryRepository ?? new QueryRepository(pool);

  void app.register(cors, { origin: true, methods: ["GET", "OPTIONS"] });
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  app.get<{ Params: RouteParams; Querystring: RouteQuery }>(
    "/api/v1/projects/:projectId/overview",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseFilters(request.query, config);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      return queryRepository.overview(request.params.projectId, parsed.filters);
    },
  );

  app.get<{ Params: RouteParams; Querystring: RouteQuery }>(
    "/api/v1/projects/:projectId/performance/series",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseFilters(request.query, config);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      return {
        items: await queryRepository.performanceSeries(
          request.params.projectId,
          parsed.filters,
          request.query.metric,
        ),
      };
    },
  );

  app.get<{ Params: RouteParams; Querystring: RouteQuery }>(
    "/api/v1/projects/:projectId/errors",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseFilters(request.query, config);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      return queryRepository.errors(request.params.projectId, parsed.filters);
    },
  );

  app.get<{ Params: RouteParams; Querystring: RouteQuery }>(
    "/api/v1/projects/:projectId/errors/:fingerprint",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseFilters(request.query, config);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      const result = await queryRepository.errorDetail(
        request.params.projectId,
        request.params.fingerprint ?? "",
        parsed.filters,
      );
      return result ?? reply.code(404).send({ error: "error_group_not_found" });
    },
  );

  app.get<{ Params: RouteParams; Querystring: RouteQuery }>(
    "/api/v1/projects/:projectId/events",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseFilters(request.query, config);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      return queryRepository.events(request.params.projectId, parsed.filters);
    },
  );

  app.get<{ Params: RouteParams; Querystring: RouteQuery }>(
    "/api/v1/projects/:projectId/releases",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseFilters(request.query, config);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      return { items: await queryRepository.releases(request.params.projectId, parsed.filters) };
    },
  );

  app.addHook("onClose", async () => {
    if (!dependencies.pool) await pool.end();
  });
  return app;
}

async function authorize(
  request: FastifyRequest<{ Params: RouteParams }>,
  repository: Pick<AdminProjectRepository, "authorize">,
): Promise<boolean> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const key = header.slice("Bearer ".length).trim();
  return key.length > 0 && repository.authorize(request.params.projectId, key);
}
