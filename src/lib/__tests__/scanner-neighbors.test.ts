import { describe, expect, it } from "vitest";
import {
  computeNeighborPosts,
  NEIGHBOR_COUNT,
  MIN_POSTS_FOR_NEIGHBORS,
  TEXT_PREVIEW_MAX,
  type ScannerNeighborPost,
} from "../scanner-neighbors";

// ── Fixtures ──────────────────────────────────────────────────────────

function makePost(
  overrides: Partial<ScannerNeighborPost> & { id: string; text: string },
): ScannerNeighborPost {
  return {
    publishedAt: "2026-03-01T00:00:00Z",
    views: 1000,
    likes: 10,
    replies: 2,
    reposts: 1,
    quotes: 0,
    shares: 0,
    ...overrides,
  };
}

/** Build an N-post corpus. The first half is strongly on-topic with the
 *  draft vocabulary ("productivity workflow habits"); the second half is
 *  off-topic ("recipes cooking dinner"). Used to verify the helper
 *  prefers on-topic posts even when some off-topic posts have higher WES. */
function buildMixedCorpus(): ScannerNeighborPost[] {
  const onTopic: ScannerNeighborPost[] = [];
  for (let i = 0; i < 6; i++) {
    onTopic.push(
      makePost({
        id: `on-${i}`,
        text: `productivity workflow habits keep the morning routine clean — note ${i}`,
        likes: 5 + i, // escalating WES
        replies: i,
      }),
    );
  }
  const offTopic: ScannerNeighborPost[] = [];
  for (let i = 0; i < 6; i++) {
    offTopic.push(
      makePost({
        id: `off-${i}`,
        text: `recipes cooking dinner pasta sauce tomato basil simple weeknight ${i}`,
        likes: 200 + i, // very high WES — should still lose to on-topic
        replies: 30,
      }),
    );
  }
  return [...onTopic, ...offTopic];
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("computeNeighborPosts", () => {
  it("returns empty array when fewer than MIN_POSTS_FOR_NEIGHBORS posts", () => {
    const posts = Array.from({ length: MIN_POSTS_FOR_NEIGHBORS - 1 }, (_, i) =>
      makePost({ id: `p-${i}`, text: "productivity workflow habits" }),
    );
    const result = computeNeighborPosts("productivity workflow habits", posts);
    expect(result).toEqual([]);
  });

  it("returns at most NEIGHBOR_COUNT posts", () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost({
        id: `p-${i}`,
        text: "productivity workflow habits morning routine",
        likes: i,
      }),
    );
    const result = computeNeighborPosts("productivity workflow habits", posts);
    expect(result.length).toBeLessThanOrEqual(NEIGHBOR_COUNT);
  });

  it("picks on-topic posts even when off-topic posts have higher WES", () => {
    const posts = buildMixedCorpus();
    const result = computeNeighborPosts(
      "productivity workflow habits morning",
      posts,
    );
    expect(result.length).toBeGreaterThan(0);
    for (const neighbor of result) {
      expect(neighbor.id.startsWith("on-")).toBe(true);
    }
  });

  it("sorts returned neighbors by raw WES descending", () => {
    const posts = Array.from({ length: 15 }, (_, i) =>
      makePost({
        id: `p-${i}`,
        text: "productivity workflow habits routine morning",
        likes: i * 10,
      }),
    );
    const result = computeNeighborPosts("productivity workflow habits", posts);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].wes).toBeGreaterThanOrEqual(result[i].wes);
    }
  });

  it("falls back to global top-WES when the draft does not classify", () => {
    const posts: ScannerNeighborPost[] = [];
    // 12 posts on one topic
    for (let i = 0; i < 12; i++) {
      posts.push(
        makePost({
          id: `p-${i}`,
          text: "productivity workflow habits routine",
          likes: i,
        }),
      );
    }
    // Draft uses vocabulary absent from the corpus
    const result = computeNeighborPosts(
      "xyzabc qwerty foobar",
      posts,
    );
    // With no topic match, we should still get up to NEIGHBOR_COUNT by raw WES
    expect(result.length).toBe(NEIGHBOR_COUNT);
    // And they should be the highest-WES posts (p-11, p-10, p-9)
    expect(result[0].id).toBe("p-11");
  });

  it("returns global top-WES when draft text is empty", () => {
    const posts = Array.from({ length: 15 }, (_, i) =>
      makePost({
        id: `p-${i}`,
        text: "productivity workflow habits",
        likes: i,
      }),
    );
    const result = computeNeighborPosts("   ", posts);
    expect(result.length).toBe(NEIGHBOR_COUNT);
    expect(result[0].id).toBe("p-14");
  });

  it("truncates long text to TEXT_PREVIEW_MAX", () => {
    const longText = "productivity ".repeat(200);
    const posts = [
      ...Array.from({ length: 14 }, (_, i) =>
        makePost({ id: `p-${i}`, text: "productivity workflow habits" }),
      ),
      makePost({ id: "long", text: longText, likes: 9999 }),
    ];
    const result = computeNeighborPosts("productivity workflow", posts);
    const long = result.find((n) => n.id === "long");
    expect(long).toBeDefined();
    expect(long!.textPreview.length).toBeLessThanOrEqual(TEXT_PREVIEW_MAX);
    expect(long!.textPreview.endsWith("…")).toBe(true);
  });

  it("computes normalized WES correctly", () => {
    const posts = Array.from({ length: 12 }, (_, i) => ({
      id: `p-${i}`,
      text: "productivity workflow habits",
      publishedAt: "2026-03-01T00:00:00Z",
      views: 100,
      likes: 10,
      replies: 0,
      reposts: 0,
      quotes: 0,
      shares: 0,
    }));
    const result = computeNeighborPosts("productivity workflow habits", posts);
    // WES raw = 10 likes * 1 = 10; normalized = 10% of 100 views = 10
    expect(result[0].wes).toBe(10);
    expect(result[0].wesNormalized).toBe(10);
  });

  it("preserves full post metadata in returned neighbors", () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost({
        id: `post-${i}`,
        text: "productivity workflow habits",
        publishedAt: `2026-03-0${(i % 9) + 1}T00:00:00Z`,
      }),
    );
    const result = computeNeighborPosts("productivity workflow habits", posts);
    expect(result[0]).toMatchObject({
      id: expect.any(String),
      textPreview: expect.any(String),
      wes: expect.any(Number),
      wesNormalized: expect.any(Number),
      publishedAt: expect.stringMatching(/^2026-/),
    });
  });
});
