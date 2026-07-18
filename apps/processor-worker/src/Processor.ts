import { analyzeEvent } from "./analyze";
import type { ProcessorConfig } from "./config";
import type { ProcessorRepository } from "./repository";

export type ProcessorStore = Pick<
  ProcessorRepository,
  "claimBatch" | "complete" | "recordFailure"
>;

export class EventProcessor {
  constructor(
    private readonly config: ProcessorConfig,
    private readonly repository: ProcessorStore,
  ) {}

  async runOnce(): Promise<number> {
    const events = await this.repository.claimBatch(
      this.config.batchSize,
      this.config.staleAfterMs,
    );
    for (const event of events) {
      try {
        await this.repository.complete(event, analyzeEvent(event.type, event.payload));
      } catch (error) {
        await this.repository.recordFailure(event, error, this.config.maxAttempts);
      }
    }
    return events.length;
  }
}
