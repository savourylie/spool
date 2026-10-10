import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("replies audit source", () => {
  it("adds a dashboard replies page with sync affordance", async () => {
    const source = await readFile(
      new URL("../replies/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("ReplySyncButton");
    expect(source).toContain("user_replies");
    expect(source).toContain("risk_level");
  });

  it("posts to the replies sync endpoint and refreshes the route", async () => {
    const source = await readFile(
      new URL(
        "../../../components/dashboard/reply-sync-button.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain('"use client"');
    expect(source).toContain('fetch("/api/replies/sync"');
    expect(source).toContain("router.refresh()");
  });

  it("lets each table row toggle its review status and refresh", async () => {
    const [table, button] = await Promise.all([
      readFile(
        new URL(
          "../../../components/dashboard/reply-table.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../components/dashboard/reply-review-button.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(table).toContain("<ReplyReviewButton");
    expect(button).toContain('"use client"');
    expect(button).toContain("fetch(`/api/replies/${replyId}`");
    expect(button).toContain('method: "PATCH"');
    expect(button).toContain("router.refresh()");
  });

  it("adds Replies to desktop and mobile navigation", async () => {
    const [sidebar, mobile] = await Promise.all([
      readFile(
        new URL(
          "../../../components/dashboard/dashboard-sidebar.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../components/dashboard/mobile-tab-bar.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(sidebar).toContain('/dashboard/replies');
    expect(mobile).toContain('/dashboard/replies');
  });
});
