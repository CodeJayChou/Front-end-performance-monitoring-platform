import { analyzeEvent } from "./analyze";
import type { ProcessorConfig } from "./config";
import type { ProcessorRepository } from "./repository";
import type { SymbolicationResult } from "./types";

export type ProcessorStore = Pick<ProcessorRepository, "claimBatch" | "complete" | "recordFailure"> & {
  symbolicate?: (event: Parameters<ProcessorRepository["complete"]>[0]) => Promise<SymbolicationResult>;
};

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
        const analysis = analyzeEvent(event.type, event.payload);
        if (this.repository.symbolicate) {
          const symbolication = await this.repository.symbolicate(event);
          await this.repository.complete(event, analysis, symbolication);
        } else {
          await this.repository.complete(event, analysis);
        }
      } catch (error) {
        await this.repository.recordFailure(event, error, this.config.maxAttempts);
      }
    }
    return events.length;
  }
}
