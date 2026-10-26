import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function read(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

describe("post library source", () => {
  it("renders four library tabs and a master-detail posts view", async () => {
    const page = await read("../posts/page.tsx");

    expect(page).toContain("LibraryTabs");
    expect(page).toContain("PostsLibrary");
    expect(page).toContain("RepliesLibrary");
    expect(page).toContain("RepostsLibrary");
    expect(page).toContain('p_only_media: tab === "media"');
  });

  it("renders media and link previews in the post detail", async () => {
    const detail = await read(
      "../../../components/dashboard/post-detail.tsx",
    );

    expect(detail).toContain("<PostMedia");
    expect(detail).toContain("<PostLinkCard");
  });

  it("refreshes expired media URLs and seeds post content once", async () => {
    const media = await read("../../../lib/post-media.ts");

    expect(media).toContain("refreshStalePostMedia");
    expect(media).toContain("seedLibraryIfNeeded");
    expect(media).toContain("media_fetched_at");
    expect(media).toContain("reposts");
  });

  it("exposes a media refresh endpoint for expired CDN links", async () => {
    const route = await read(
      "../../api/posts/[postId]/media/route.ts",
    );

    expect(route).toContain("getPostMedia");
    expect(route).toContain("carousel");
    expect(route).toContain("post.media_type === \"CAROUSEL\"");
  });
});
