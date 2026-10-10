import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("BackfillProgress source", () => {
  it("does not auto-start backfill on mount", async () => {
    const source = await readFile(
      new URL("../backfill-progress.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain('fetch("/api/backfill/start"');
    expect(source).toContain("useBackfillJob");
    expect(source).toContain("await retry()");
  });
});
