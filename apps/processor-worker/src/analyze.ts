import { createHash } from "node:crypto";
import type { EventAnalysis, ErrorAnalysis, MetricAnalysis } from "./types";

const metrics = new Set(["FP", "FCP", "LCP", "CLS", "INP", "TTFB"]);
const thresholds: Record<string, { good: number; poor: number }> = {
  FP: { good: 1_800, poor: 3_000 },
  FCP: { good: 1_800, poor: 3_000 },
  LCP: { good: 2_500, poor: 4_000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1_800 },
};

export function analyzeEvent(type: string, payload: unknown): EventAnalysis {
  if (!isRecord(payload)) return null;
  if (type === "error") return analyzeError(payload);
  if (type === "performance") return analyzeMetric(payload);
  return null;
}

function analyzeError(payload: Record<string, unknown>): ErrorAnalysis | null {
  const kind = stringValue(payload.kind) ?? "unknown";
  const title =
    stringValue(payload.message) ??
    stringValue(payload.reason) ??
    stringValue(payload.url) ??
    kind;
  const culprit = findCulprit(payload);
  const normalizedTitle = normalizeTitle(title);
  const fingerprintSource = [kind, normalizedTitle, culprit ?? ""].join("|");

  return {
    type: "error",
    kind,
    title: title.slice(0, 500),
    culprit,
    fingerprint: createHash("sha256").update(fingerprintSource).digest("hex"),
  };
}

function analyzeMetric(payload: Record<string, unknown>): MetricAnalysis | null {
  const metric = stringValue(payload.metric);
  const value = payload.value;
  if (
    !metric ||
    !metrics.has(metric) ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return { type: "metric", metric, value, rating: rateMetric(metric, value) };
}

function rateMetric(metric: string, value: number): MetricAnalysis["rating"] {
  const threshold = thresholds[metric]!;
  if (value <= threshold.good) return "good";
  if (value > threshold.poor) return "poor";
  return "needs-improvement";
}

function findCulprit(payload: Record<string, unknown>): string | null {
  const frames = payload.stackFrames;
  if (!Array.isArray(frames)) return stringValue(payload.source) ?? null;
  const frame = [...frames].reverse().find(isRecord);
  if (!frame) return null;
  const file = stringValue(frame.file) ?? "unknown";
  const line = typeof frame.line === "number" ? frame.line : 0;
  const functionName = stringValue(frame.functionName) ?? "anonymous";
  return `${file}:${line}:${functionName}`.slice(0, 1_000);
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b0x[\da-f]+\b/gi, "<hex>")
    .replace(/\b\d+\b/g, "<number>")
    .replace(/\s+/g, " ")
    .trim();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
