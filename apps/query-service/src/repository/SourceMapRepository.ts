import type { Pool } from "pg";
import type { SourceMapUpload } from "../sourceMaps";

export class SourceMapRepository {
  constructor(private readonly pool: Pool) {}

  async list(projectId: string): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT id, release, dist, artifact_name, content_hash, source_count,
              created_at, updated_at
       FROM source_maps WHERE project_id = $1
       ORDER BY updated_at DESC, id DESC`,
      [projectId],
    );
    return result.rows;
  }

  async upsert(projectId: string, input: SourceMapUpload): Promise<unknown> {
    const result = await this.pool.query(
      `INSERT INTO source_maps (
         project_id, release, dist, artifact_name, source_map, content_hash, source_count
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (project_id, release, dist, artifact_name) DO UPDATE SET
         source_map = EXCLUDED.source_map,
         content_hash = EXCLUDED.content_hash,
         source_count = EXCLUDED.source_count,
         updated_at = now()
       RETURNING id, release, dist, artifact_name, content_hash, source_count,
                 created_at, updated_at`,
      [
        projectId, input.release, input.dist, input.artifactName,
        input.sourceMap, input.contentHash, input.sourceCount,
      ],
    );
    return result.rows[0];
  }

  async delete(projectId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM source_maps WHERE project_id = $1 AND id = $2",
      [projectId, id],
    );
    return result.rowCount === 1;
  }
}
