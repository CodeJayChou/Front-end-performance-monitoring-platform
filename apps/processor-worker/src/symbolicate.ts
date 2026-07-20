import {
  GREATEST_LOWER_BOUND,
  originalPositionFor,
  sourceContentFor,
  TraceMap,
  type SourceMapInput,
} from "@jridgewell/trace-mapping";
import type { Pool } from "pg";
import type { ClaimedEvent, SymbolicatedFrame, SymbolicationResult } from "./types";

interface StackFrame {
  file?: string;
  line?: number;
  col?: number;
  functionName?: string;
  raw?: string;
}

interface SourceMapRow {
  id: string;
  artifact_name: string;
  source_map: SourceMapInput;
}

export class SourceMapSymbolicator {
  constructor(private readonly pool: Pool) {}

  async symbolicate(event: ClaimedEvent): Promise<SymbolicationResult> {
    if (event.type !== "error") return { status: "not_attempted", stack: null };
    const frames = stackFrames(event.payload);
    if (!frames.length) return { status: "no_stack", stack: null };
    if (!event.release) return { status: "no_release", stack: null };

    try {
      const mapped: SymbolicatedFrame[] = [];
      const mapCache = new Map<string, TraceMap | null>();
      for (const frame of frames) {
        if (!frame.file || !frame.line) continue;
        const artifactPath = artifactPathFromFile(frame.file);
        let trace = mapCache.get(artifactPath);
        if (trace === undefined) {
          const sourceMap = await this.findMap(event.projectId, event.release, artifactPath);
          trace = sourceMap ? new TraceMap(sourceMap.source_map) : null;
          mapCache.set(artifactPath, trace);
        }
        if (!trace) continue;
        const original = originalPositionFor(trace, {
          line: frame.line,
          column: Math.max(0, (frame.col ?? 1) - 1),
          bias: GREATEST_LOWER_BOUND,
        });
        if (!original.source || original.line === null || original.column === null) continue;
        const content = sourceContentFor(trace, original.source);
        mapped.push({
          ...frame,
          originalFile: original.source,
          originalLine: original.line,
          originalCol: original.column + 1,
          originalFunctionName: original.name ?? frame.functionName,
          sourceLine: sourceLine(content, original.line),
          inApp: !isThirdParty(original.source),
        });
      }
      return mapped.length
        ? { status: "symbolicated", stack: mapped }
        : { status: "map_not_found", stack: null };
    } catch {
      return { status: "failed", stack: null };
    }
  }

  private async findMap(
    projectId: string,
    release: string,
    artifactPath: string,
  ): Promise<SourceMapRow | null> {
    const result = await this.pool.query<SourceMapRow>(
      `SELECT id, artifact_name, source_map
       FROM source_maps
       WHERE project_id = $1 AND release = $2
         AND ($3 = artifact_name OR $3 LIKE '%/' || artifact_name)
       ORDER BY length(artifact_name) DESC, updated_at DESC
       LIMIT 1`,
      [projectId, release, artifactPath],
    );
    return result.rows[0] ?? null;
  }
}

function stackFrames(payload: unknown): StackFrame[] {
  if (!payload || typeof payload !== "object") return [];
  const frames = (payload as Record<string, unknown>).stackFrames;
  return Array.isArray(frames)
    ? frames.filter((frame): frame is StackFrame => Boolean(frame) && typeof frame === "object")
    : [];
}

function artifactPathFromFile(file: string): string {
  try {
    return decodeURIComponent(new URL(file).pathname).replace(/^\/+/, "");
  } catch {
    return file.split(/[?#]/, 1)[0]!.replace(/^\/+/, "");
  }
}

function sourceLine(content: string | null, line: number): string | undefined {
  if (!content) return undefined;
  return content.split(/\r?\n/)[line - 1]?.trim().slice(0, 500) || undefined;
}

function isThirdParty(source: string): boolean {
  return /(^|\/)node_modules\//.test(source) || source.startsWith("http://") || source.startsWith("https://");
}
