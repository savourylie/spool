import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("posts sync affordance source", () => {
  it("exposes a manual posts sync button in the posts header", async () => {
    const source = await readFile(
      new URL("../posts/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("PostSyncButton");
  });

  it("posts to the current-user sync endpoint and refreshes the route", async () => {
    const source = await readFile(
      new URL(
        "../../../components/dashboard/post-sync-button.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain('"use client"');
    expect(source).toContain('fetch("/api/posts/sync"');
    expect(source).toContain("router.refresh()");
  });
});
