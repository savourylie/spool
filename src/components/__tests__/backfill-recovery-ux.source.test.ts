import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("backfill recovery UI source", () => {
  it("shows resume and retry labels in the loading experience", async () => {
    const source = await readFile(
      new URL("../backfill-progress.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("Resume import");
    expect(source).toContain("Retry import");
  });

  it("shows resume and retry labels in the dashboard banner", async () => {
    const source = await readFile(
      new URL("../dashboard/backfill-status-banner.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("Resume import");
    expect(source).toContain("Retry import");
  });
});
