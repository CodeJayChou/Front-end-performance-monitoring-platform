import type { Pool } from "pg";

export class AdminProjectRepository {
  constructor(private readonly pool: Pool) {}

  async authorize(projectId: string, adminKey: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
       FROM project_admin_keys AS admin_key
       JOIN projects AS project ON project.id = admin_key.project_id
       WHERE admin_key.project_id = $1
         AND admin_key.admin_key = $2
         AND admin_key.status = 'active'
         AND project.status = 'active'
       LIMIT 1`,
      [projectId, adminKey],
    );
    return result.rowCount === 1;
  }
}
