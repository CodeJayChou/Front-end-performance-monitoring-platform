import { describe, expect, it } from "vitest";
import { parseSourceMapUpload } from "./sourceMaps";

describe("source map upload validation", () => {
  it("normalizes a valid source map", () => {
    const result = parseSourceMapUpload({
      release: "web@1.0.0",
      artifactName: "https://cdn.example.com/assets/app.js?v=1",
      sourceMap: { version: 3, names: [], sources: ["src/app.ts"], mappings: "AAAA" },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { artifactName: "assets/app.js", sourceCount: 1 },
    });
  });

  it("rejects malformed mappings", () => {
    expect(parseSourceMapUpload({
      release: "web@1.0.0",
      artifactName: "app.js",
      sourceMap: { version: 3 },
    })).toEqual({ ok: false, reason: "invalid_source_map_mappings" });
  });
});
