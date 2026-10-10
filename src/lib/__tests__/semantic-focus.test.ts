import { describe, it, expect } from "vitest";
import {
  computeRollingScores,
  computeSemanticFocusData,
  getScoreLevel,
  MIN_POSTS_FOR_FOCUS,
  type SemanticFocusPost,
} from "@/lib/semantic-focus";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(
  topic: string | null,
  daysAgo: number,
  text: string | null = "some text",
): SemanticFocusPost {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { topic_tag: topic, text_full: text, published_at: d.toISOString() };
}

// ---------------------------------------------------------------------------
// getScoreLevel
// ---------------------------------------------------------------------------

describe("getScoreLevel", () => {
  it("returns 'high' for scores >= 70", () => {
    expect(getScoreLevel(70)).toBe("high");
    expect(getScoreLevel(100)).toBe("high");
    expect(getScoreLevel(85)).toBe("high");
  });

  it("returns 'medium' for scores 50-69", () => {
    expect(getScoreLevel(50)).toBe("medium");
    expect(getScoreLevel(69)).toBe("medium");
  });

  it("returns 'low' for scores < 50", () => {
    expect(getScoreLevel(0)).toBe("low");
    expect(getScoreLevel(49)).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// computeRollingScores
// ---------------------------------------------------------------------------

describe("computeRollingScores", () => {
  it("returns empty array for no posts", () => {
    expect(computeRollingScores([])).toEqual([]);
  });

  it("skips days with fewer than 3 posts in window", () => {
    // Only 2 posts — every day window has < 3 posts
    const posts = [makePost("ai", 5), makePost("ai", 10)];
    expect(computeRollingScores(posts)).toEqual([]);
  });

  it("produces score points for windows with enough posts", () => {
    // 5 posts all tagged "ai" within the last 10 days
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost("ai", i + 1),
    );
    const points = computeRollingScores(posts);
    expect(points.length).toBeGreaterThan(0);
    // All same topic → focus score should be 100
    for (const point of points) {
      expect(point.score).toBe(100);
    }
  });

  it("each point has date, dateLabel, and score fields", () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost("ai", i + 1),
    );
    const points = computeRollingScores(posts);
    for (const point of points) {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof point.dateLabel).toBe("string");
      expect(point.score).toBeGreaterThanOrEqual(0);
      expect(point.score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// computeSemanticFocusData
// ---------------------------------------------------------------------------

describe("computeSemanticFocusData", () => {
  it("returns zeroed data when fewer than MIN_POSTS_FOR_FOCUS posts have text_full", () => {
    const posts = Array.from({ length: MIN_POSTS_FOR_FOCUS - 1 }, (_, i) =>
      makePost("ai", i),
    );
    const data = computeSemanticFocusData(posts);
    expect(data.currentScore).toBe(0);
    expect(data.trend).toEqual([]);
    expect(data.topClusters).toEqual([]);
    expect(data.postCount).toBe(MIN_POSTS_FOR_FOCUS - 1);
  });

  it("returns zeroed data when posts have null text_full", () => {
    const posts = Array.from({ length: 15 }, (_, i) =>
      makePost("ai", i, null),
    );
    const data = computeSemanticFocusData(posts);
    expect(data.postCount).toBe(0);
    expect(data.currentScore).toBe(0);
  });

  it("computes focus data for a sufficient dataset", () => {
    // 12 posts — 8 about "ai", 4 about "design"
    const posts = [
      ...Array.from({ length: 8 }, (_, i) =>
        makePost("ai", i + 1, "artificial intelligence machine learning"),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makePost("design", i + 1, "user interface design systems"),
      ),
    ];
    const data = computeSemanticFocusData(posts);
    expect(data.postCount).toBe(12);
    expect(data.currentScore).toBe(100); // all posts match top 3 tags (only 2 tags exist)
    expect(data.topClusters.length).toBeGreaterThan(0);
    expect(data.topClusters.length).toBeLessThanOrEqual(3);
  });

  it("returns lower score when topics are diverse", () => {
    // 12 posts with 6 different tags — top 3 cover only half
    const tags = ["a", "b", "c", "d", "e", "f"];
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost(tags[i % tags.length], i + 1, `post about ${tags[i % tags.length]} topic`),
    );
    const data = computeSemanticFocusData(posts);
    expect(data.currentScore).toBeLessThan(100);
    expect(data.currentScore).toBeGreaterThan(0);
  });
});
