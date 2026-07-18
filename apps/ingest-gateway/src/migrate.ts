import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://monitor:monitor@localhost:5432/monitor";
const migrationsDirectory = fileURLToPath(
  new URL("../../../database/migrations/", import.meta.url),
);

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [file],
    );
    if (applied.rowCount) continue;

    const sql = await readFile(new URL(`../../../database/migrations/${file}`, import.meta.url), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.info(`Applied migration ${file}`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  if (process.env.APPLY_DEMO_SEED === "true") {
    const seed = await readFile(
      new URL("../../../database/seeds/demo-project.sql", import.meta.url),
      "utf8",
    );
    await pool.query(seed);
    console.info("Applied demo project seed");
  }
} finally {
  await pool.end();
}
