import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { Pool } from "pg";
import type { QueryConfig } from "./config";
import { parseCreateAlertRule, parseEnabled } from "./alerts";
import { parseErrorIssueUpdate } from "./errorWorkflow";
import { parseFilters } from "./filters";
import { parseSourceMapUpload } from "./sourceMaps";
import { AlertRepository } from "./repository/AlertRepository";
import { AdminProjectRepository } from "./repository/AdminProjectRepository";
import { QueryRepository } from "./repository/QueryRepository";
import { ErrorWorkflowRepository } from "./repository/ErrorWorkflowRepository";
import { SourceMapRepository } from "./repository/SourceMapRepository";

interface RouteParams {
  projectId: string;
  fingerprint?: string;
  ruleId?: string;
  sourceMapId?: string;
}

type RouteQuery = Record<string, string | undefined>;

export interface QueryAppDependencies {
  pool?: Pool;
  adminRepository?: Pick<AdminProjectRepository, "authorize">;
  queryRepository?: Pick<
    QueryRepository,
    "overview" | "performanceSeries" | "errors" | "errorDetail" | "events" | "releases"
  >;
  alertRepository?: Pick<
    AlertRepository,
    "listRules" | "createRule" | "setEnabled" | "deleteRule" | "incidents"
  >;
  sourceMapRepository?: Pick<SourceMapRepository, "list" | "upsert" | "delete">;
  errorWorkflowRepository?: Pick<ErrorWorkflowRepository, "update">;
}

export function createApp(
  config: QueryConfig,
  dependencies: QueryAppDependencies = {},
): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });
  const pool = dependencies.pool ?? new Pool({ connectionString: config.databaseUrl });
  const adminRepository = dependencies.adminRepository ?? new AdminProjectRepository(pool);
  const queryRepository = dependencies.queryRepository ?? new QueryRepository(pool);
  const alertRepository = dependencies.alertRepository ?? new AlertRepository(pool);
  const sourceMapRepository = dependencies.sourceMapRepository ?? new SourceMapRepository(pool);
  const errorWorkflowRepository = dependencies.errorWorkflowRepository ?? new ErrorWorkflowRepository(pool);

  void app.register(cors, { origin: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });
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

  app.get<{ Params: RouteParams }>(
    "/api/v1/projects/:projectId/alert-rules",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      return { items: await alertRepository.listRules(request.params.projectId) };
    },
  );

  app.get<{ Params: RouteParams }>(
    "/api/v1/projects/:projectId/source-maps",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      return { items: await sourceMapRepository.list(request.params.projectId) };
    },
  );

  app.post<{ Params: RouteParams; Body: unknown }>(
    "/api/v1/projects/:projectId/source-maps",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseSourceMapUpload(request.body);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      const sourceMap = await sourceMapRepository.upsert(request.params.projectId, parsed.value);
      return reply.code(201).send(sourceMap);
    },
  );

  app.delete<{ Params: RouteParams }>(
    "/api/v1/projects/:projectId/source-maps/:sourceMapId",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const deleted = await sourceMapRepository.delete(
        request.params.projectId,
        request.params.sourceMapId ?? "",
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ error: "source_map_not_found" });
    },
  );

  app.patch<{ Params: RouteParams; Body: unknown }>(
    "/api/v1/projects/:projectId/errors/:fingerprint/status",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseErrorIssueUpdate(request.body);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      const issue = await errorWorkflowRepository.update(
        request.params.projectId,
        request.params.fingerprint ?? "",
        parsed.value,
      );
      return issue ?? reply.code(404).send({ error: "error_group_not_found" });
    },
  );

  app.post<{ Params: RouteParams; Body: unknown }>(
    "/api/v1/projects/:projectId/alert-rules",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseCreateAlertRule(request.body);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      const rule = await alertRepository.createRule(request.params.projectId, parsed.value);
      return reply.code(201).send(rule);
    },
  );

  app.patch<{ Params: RouteParams; Body: unknown }>(
    "/api/v1/projects/:projectId/alert-rules/:ruleId",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const enabled = parseEnabled(request.body);
      if (enabled === null) return reply.code(400).send({ error: "invalid_alert_update" });
      const rule = await alertRepository.setEnabled(
        request.params.projectId,
        request.params.ruleId ?? "",
        enabled,
      );
      return rule ?? reply.code(404).send({ error: "alert_rule_not_found" });
    },
  );

  app.delete<{ Params: RouteParams }>(
    "/api/v1/projects/:projectId/alert-rules/:ruleId",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const deleted = await alertRepository.deleteRule(
        request.params.projectId,
        request.params.ruleId ?? "",
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ error: "alert_rule_not_found" });
    },
  );

  app.get<{ Params: RouteParams; Querystring: RouteQuery }>(
    "/api/v1/projects/:projectId/alert-incidents",
    async (request, reply) => {
      if (!(await authorize(request, adminRepository))) return reply.code(401).send({ error: "unauthorized" });
      const parsed = parseFilters(request.query, config);
      if (!parsed.ok) return reply.code(400).send({ error: parsed.reason });
      return alertRepository.incidents(request.params.projectId, parsed.filters);
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
