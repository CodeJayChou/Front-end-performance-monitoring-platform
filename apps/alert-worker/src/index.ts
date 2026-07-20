import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { AlertWorker } from "./AlertWorker";
import { loadConfig } from "./config";
import { AlertRepository } from "./repository";

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const worker = new AlertWorker(config, new AlertRepository(pool));
let stopping = false;

const stop = (): void => {
  stopping = true;
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  while (!stopping) {
    try {
      await worker.runOnce();
    } catch (error) {
      console.error("Alert worker iteration failed", error);
    }
    if (!stopping) await delay(config.pollIntervalMs);
  }
} finally {
  await pool.end();
}
