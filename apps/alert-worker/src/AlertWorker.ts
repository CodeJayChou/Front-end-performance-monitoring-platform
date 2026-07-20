import type { AlertWorkerConfig } from "./config";
import { completedWindow, isBreached } from "./evaluate";
import type { AlertRule, ClaimedDelivery, EvaluationWindow } from "./types";

export interface AlertStore {
  listEnabledRules(): Promise<AlertRule[]>;
  evaluateValue(rule: AlertRule, window: EvaluationWindow): Promise<number>;
  recordEvaluation(rule: AlertRule, window: EvaluationWindow, value: number, breached: boolean): Promise<boolean>;
  claimDeliveries(limit: number, staleAfterMs: number): Promise<ClaimedDelivery[]>;
  markDelivered(id: string, responseStatus: number): Promise<void>;
  markDeliveryFailure(delivery: ClaimedDelivery, error: unknown, maxAttempts: number): Promise<void>;
}

type Fetch = typeof fetch;

export class AlertWorker {
  constructor(
    private readonly config: AlertWorkerConfig,
    private readonly repository: AlertStore,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async runOnce(now = new Date()): Promise<{ evaluated: number; delivered: number }> {
    let evaluated = 0;
    for (const rule of await this.repository.listEnabledRules()) {
      const window = completedWindow(now, rule.windowMinutes);
      const value = await this.repository.evaluateValue(rule, window);
      if (await this.repository.recordEvaluation(rule, window, value, isBreached(rule, value))) {
        evaluated += 1;
      }
    }

    let delivered = 0;
    const deliveries = await this.repository.claimDeliveries(
      this.config.deliveryBatchSize,
      this.config.deliveryStaleAfterMs,
    );
    for (const delivery of deliveries) {
      try {
        const response = await this.postWebhook(delivery);
        if (!response.ok) throw new Error(`Webhook responded with HTTP ${response.status}`);
        await this.repository.markDelivered(delivery.id, response.status);
        delivered += 1;
      } catch (error) {
        await this.repository.markDeliveryFailure(delivery, error, this.config.deliveryMaxAttempts);
      }
    }
    return { evaluated, delivered };
  }

  private postWebhook(delivery: ClaimedDelivery): Promise<Response> {
    return this.fetchImpl(delivery.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "monitor-alert-worker/1.0" },
      body: JSON.stringify(delivery.payload),
      signal: AbortSignal.timeout(this.config.deliveryTimeoutMs),
    });
  }
}
