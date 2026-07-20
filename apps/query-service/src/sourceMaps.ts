import { createHash } from "node:crypto";

export interface SourceMapUpload {
  release: string;
  dist: string;
  artifactName: string;
  sourceMap: Record<string, unknown>;
  contentHash: string;
  sourceCount: number;
}

export function parseSourceMapUpload(
  value: unknown,
): { ok: true; value: SourceMapUpload } | { ok: false; reason: string } {
  if (!isRecord(value)) return { ok: false, reason: "invalid_source_map_upload" };
  const release = text(value.release);
  const dist = text(value.dist);
  const artifactName = normalizeArtifact(text(value.artifactName));
  let sourceMap: unknown = value.sourceMap;
  if (typeof sourceMap === "string") {
    try {
      sourceMap = JSON.parse(sourceMap);
    } catch {
      return { ok: false, reason: "invalid_source_map_json" };
    }
  }
  if (!release || release.length > 200) return { ok: false, reason: "invalid_release" };
  if (!artifactName || artifactName.length > 1_000) return { ok: false, reason: "invalid_artifact_name" };
  if (!isRecord(sourceMap) || sourceMap.version !== 3) {
    return { ok: false, reason: "invalid_source_map" };
  }
  const hasMappings = typeof sourceMap.mappings === "string";
  const hasSections = Array.isArray(sourceMap.sections);
  if (!hasMappings && !hasSections) return { ok: false, reason: "invalid_source_map_mappings" };
  const serialized = JSON.stringify(sourceMap);
  return {
    ok: true,
    value: {
      release,
      dist: dist.slice(0, 200),
      artifactName,
      sourceMap,
      contentHash: createHash("sha256").update(serialized).digest("hex"),
      sourceCount: Array.isArray(sourceMap.sources) ? sourceMap.sources.length : 0,
    },
  };
}

function normalizeArtifact(value: string): string {
  return value.split(/[?#]/, 1)[0]!.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
