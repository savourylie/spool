import { describe, expect, it } from "vitest";

import type { ThreadsPost } from "../threads-api.types";
import {
  getThreadsRefId,
  isRepostFacade,
  toPostContentFields,
  toRepostRow,
} from "../post-media";

function makePost(overrides: Partial<ThreadsPost> = {}): ThreadsPost {
  return {
    id: "media-1",
    media_type: "IMAGE",
    text: "hello",
    timestamp: "2026-10-01T00:00:00Z",
    permalink: "https://threads.com/@user/post/1",
    shortcode: "abc",
    ...overrides,
  };
}

describe("post media mapping", () => {
  it("keeps the media and link fields Threads returns", () => {
    const fields = toPostContentFields(
      makePost({
        media_url: "https://cdn.example/image.jpg",
        thumbnail_url: "https://cdn.example/thumb.jpg",
        alt_text: "alt",
        link_attachment_url: "https://youtu.be/abc",
        children: { data: [{ id: "child-1" }] },
        is_quote_post: true,
        quoted_post: { id: "quoted-1" },
        gif_url: "https://cdn.example/gif.mp4",
        topic_tag: "AI",
      }),
      "2026-10-02T00:00:00Z",
    );

    expect(fields).toEqual({
      media_url: "https://cdn.example/image.jpg",
      thumbnail_url: "https://cdn.example/thumb.jpg",
      alt_text: "alt",
      link_attachment_url: "https://youtu.be/abc",
      children: { data: [{ id: "child-1" }] },
      media_product_type: null,
      is_quote_post: true,
      quoted_post_id: "quoted-1",
      gif_url: "https://cdn.example/gif.mp4",
      media_fetched_at: "2026-10-02T00:00:00Z",
    });
  });

  it("identifies repost facades and maps their reference", () => {
    const post = makePost({
      id: "repost-1",
      media_type: "REPOST_FACADE",
      shortcode: "rp1",
    });

    expect(isRepostFacade(post)).toBe(true);
    expect(toRepostRow("user-1", post)).toEqual({
      user_id: "user-1",
      threads_media_id: "repost-1",
      permalink: "https://threads.com/@user/post/1",
      shortcode: "rp1",
      reposted_at: "2026-10-01T00:00:00Z",
    });
  });

  it("normalizes reference ids returned as objects or strings", () => {
    expect(getThreadsRefId({ id: "a" })).toBe("a");
    expect(getThreadsRefId("b")).toBe("b");
    expect(getThreadsRefId(null)).toBeNull();
  });
});
