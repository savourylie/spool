import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const DASHBOARD_FILES = [
  "../page.tsx",
  "../layout.tsx",
  "../create/compose/page.tsx",
  "../insights/page.tsx",
  "../understand/page.tsx",
  "../understand/audience/page.tsx",
] as const;

describe("dashboard latest backfill source", () => {
  it("uses the latest overall backfill job instead of filtering to visible statuses", async () => {
    for (const relativePath of DASHBOARD_FILES) {
      const source = await readFile(new URL(relativePath, import.meta.url), "utf8");

      expect(source).toContain("getMostRecentBackfillJob");
      expect(source).not.toContain("BACKFILL_VISIBLE_STATUSES");
    }
  });
});
