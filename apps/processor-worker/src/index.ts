import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { loadConfig } from "./config";
import { EventProcessor } from "./Processor";
import { ProcessorRepository } from "./repository";

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const processor = new EventProcessor(config, new ProcessorRepository(pool));
let stopping = false;

const stop = (): void => {
  stopping = true;
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  while (!stopping) {
    try {
      const claimed = await processor.runOnce();
      if (claimed === 0) await delay(config.pollIntervalMs);
    } catch (error) {
      console.error("Processor iteration failed", error);
      await delay(config.pollIntervalMs);
    }
  }
} finally {
  await pool.end();
}
