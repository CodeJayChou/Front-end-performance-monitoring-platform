import type { Pool } from "pg";
import type { AuthorizedProject } from "../types";

export class ProjectRepository {
  constructor(private readonly pool: Pool) {}

  async authorize(projectId: string, sdkKey: string): Promise<AuthorizedProject | null> {
    const result = await this.pool.query<{
      id: string;
      allowed_origins: unknown;
    }>(
      `SELECT p.id, p.allowed_origins
       FROM projects p
       JOIN project_keys k ON k.project_id = p.id
       WHERE p.id = $1 AND k.public_key = $2
         AND p.status = 'active' AND k.status = 'active'
       LIMIT 1`,
      [projectId, sdkKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      allowedOrigins: Array.isArray(row.allowed_origins) ? row.allowed_origins.filter((v): v is string => typeof v === "string") : [],
    };
  }
}
