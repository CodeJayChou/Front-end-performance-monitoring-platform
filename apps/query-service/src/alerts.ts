export type AlertRuleType = "error_count" | "performance_p75";

export interface CreateAlertRuleInput {
  name: string;
  type: AlertRuleType;
  metric: string | null;
  threshold: number;
  windowMinutes: number;
  consecutivePeriods: number;
  cooldownMinutes: number;
  environment: string | null;
  release: string | null;
  platform: string | null;
  webhookUrl: string | null;
  enabled: boolean;
}

const metrics = new Set(["FP", "FCP", "LCP", "CLS", "INP", "TTFB"]);

export function parseCreateAlertRule(
  value: unknown,
): { ok: true; value: CreateAlertRuleInput } | { ok: false; reason: string } {
  if (!isRecord(value)) return { ok: false, reason: "invalid_alert_rule" };
  const name = text(value.name);
  const type = value.type;
  const metric = text(value.metric) || null;
  const threshold = number(value.threshold);
  const windowMinutes = integer(value.windowMinutes, 5);
  const consecutivePeriods = integer(value.consecutivePeriods, 1);
  const cooldownMinutes = integer(value.cooldownMinutes, 15);

  if (!name || name.length > 120) return { ok: false, reason: "invalid_alert_name" };
  if (type !== "error_count" && type !== "performance_p75") {
    return { ok: false, reason: "invalid_alert_type" };
  }
  if (threshold === null || threshold < 0) return { ok: false, reason: "invalid_alert_threshold" };
  if (windowMinutes < 1 || windowMinutes > 1440) return { ok: false, reason: "invalid_alert_window" };
  if (consecutivePeriods < 1 || consecutivePeriods > 10) {
    return { ok: false, reason: "invalid_consecutive_periods" };
  }
  if (cooldownMinutes < 1 || cooldownMinutes > 1440) {
    return { ok: false, reason: "invalid_cooldown" };
  }
  if (type === "performance_p75" && (!metric || !metrics.has(metric))) {
    return { ok: false, reason: "invalid_alert_metric" };
  }
  const webhookUrl = text(value.webhookUrl) || null;
  if (webhookUrl && !validWebhook(webhookUrl)) {
    return { ok: false, reason: "invalid_webhook_url" };
  }

  return {
    ok: true,
    value: {
      name,
      type,
      metric: type === "performance_p75" ? metric : null,
      threshold,
      windowMinutes,
      consecutivePeriods,
      cooldownMinutes,
      environment: optionalText(value.environment),
      release: optionalText(value.release),
      platform: optionalText(value.platform),
      webhookUrl,
      enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    },
  };
}

export function parseEnabled(value: unknown): boolean | null {
  return isRecord(value) && typeof value.enabled === "boolean" ? value.enabled : null;
}

function validWebhook(value: string): boolean {
  if (value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function optionalText(value: unknown): string | null {
  const valueText = text(value);
  return valueText ? valueText.slice(0, 200) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  return typeof value === "number" && Number.isInteger(value) ? value : -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
