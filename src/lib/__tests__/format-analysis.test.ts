import { describe, expect, it } from "vitest";
import type { PostRow } from "@/components/dashboard/post-table";
import {
  MIN_POSTS_FOR_ANALYSIS,
  TEXT_LENGTH_BUCKETS,
  computeFormatBreakdown,
  computeTextLengthBuckets,
  generateFormatRecommendation,
} from "../format-analysis";

function makePost(
  mediaType: string,
  textLength: number,
  overrides: Partial<PostRow> = {},
): PostRow {
  return {
    id: crypto.randomUUID(),
    media_type: mediaType,
    text_preview: "x".repeat(textLength),
    permalink: null,
    published_at: "2025-03-15T12:00:00Z",
    views: 1000,
    likes: 50,
    replies: 10,
    reposts: 5,
    quotes: 2,
    shares: 3,
    engagement_rate: 7,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("MIN_POSTS_FOR_ANALYSIS", () => {
  it("is 5", () => {
    expect(MIN_POSTS_FOR_ANALYSIS).toBe(5);
  });
});

describe("TEXT_LENGTH_BUCKETS", () => {
  it("has 3 buckets: short, medium, long", () => {
    expect(TEXT_LENGTH_BUCKETS).toHaveLength(3);
    expect(TEXT_LENGTH_BUCKETS[0].bucket).toBe("short");
    expect(TEXT_LENGTH_BUCKETS[1].bucket).toBe("medium");
    expect(TEXT_LENGTH_BUCKETS[2].bucket).toBe("long");
  });

  it("short covers 0-50", () => {
    expect(TEXT_LENGTH_BUCKETS[0].min).toBe(0);
    expect(TEXT_LENGTH_BUCKETS[0].max).toBe(50);
  });

  it("medium covers 51-150", () => {
    expect(TEXT_LENGTH_BUCKETS[1].min).toBe(51);
    expect(TEXT_LENGTH_BUCKETS[1].max).toBe(150);
  });

  it("long covers 151-280", () => {
    expect(TEXT_LENGTH_BUCKETS[2].min).toBe(151);
    expect(TEXT_LENGTH_BUCKETS[2].max).toBe(280);
  });
});

// ---------------------------------------------------------------------------
// computeFormatBreakdown
// ---------------------------------------------------------------------------

describe("computeFormatBreakdown", () => {
  it("returns empty array for no posts", () => {
    expect(computeFormatBreakdown([])).toEqual([]);
  });

  it("returns single entry for posts of one type", () => {
    const posts = [
      makePost("TEXT", 100, { views: 1000, likes: 10 }),
      makePost("TEXT", 80, { views: 2000, likes: 20 }),
    ];
    const result = computeFormatBreakdown(posts);
    expect(result).toHaveLength(1);
    expect(result[0].mediaType).toBe("TEXT");
    expect(result[0].count).toBe(2);
    expect(result[0].avgViews).toBe(1500);
  });

  it("returns entries in MEDIA_TYPE_ORDER", () => {
    const posts = [
      makePost("CAROUSEL", 100),
      makePost("TEXT", 100),
      makePost("VIDEO", 100),
      makePost("IMAGE", 100),
    ];
    const result = computeFormatBreakdown(posts);
    expect(result.map((r) => r.mediaType)).toEqual([
      "TEXT",
      "IMAGE",
      "VIDEO",
      "CAROUSEL",
    ]);
  });

  it("skips media types with no posts", () => {
    const posts = [makePost("TEXT", 100), makePost("VIDEO", 100)];
    const result = computeFormatBreakdown(posts);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.mediaType)).toEqual(["TEXT", "VIDEO"]);
  });

  it("computes avgWes using computeNormalizedWES", () => {
    // WES = likes*1 + replies*8 + reposts*3 + quotes*5 + shares*10
    // For this post: 50 + 80 + 15 + 10 + 30 = 185
    // Normalized: (185 / 1000) * 100 = 18.5
    const posts = [
      makePost("TEXT", 100, {
        views: 1000,
        likes: 50,
        replies: 10,
        reposts: 5,
        quotes: 2,
        shares: 3,
      }),
    ];
    const result = computeFormatBreakdown(posts);
    expect(result[0].avgWes).toBeCloseTo(18.5);
  });

  it("averages views across multiple posts in a group", () => {
    const posts = [
      makePost("IMAGE", 100, { views: 500 }),
      makePost("IMAGE", 100, { views: 1500 }),
      makePost("IMAGE", 100, { views: 1000 }),
    ];
    const result = computeFormatBreakdown(posts);
    expect(result[0].avgViews).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// computeTextLengthBuckets
// ---------------------------------------------------------------------------

describe("computeTextLengthBuckets", () => {
  it("returns 3 buckets with zero counts for no posts", () => {
    const result = computeTextLengthBuckets([]);
    expect(result).toHaveLength(3);
    for (const bucket of result) {
      expect(bucket.count).toBe(0);
      expect(bucket.avgEngagementRate).toBe(0);
      expect(bucket.avgViews).toBe(0);
    }
  });

  it("classifies text_preview length into correct bucket", () => {
    const posts = [
      makePost("TEXT", 30), // short
      makePost("TEXT", 100), // medium
      makePost("TEXT", 200), // long
    ];
    const result = computeTextLengthBuckets(posts);
    expect(result[0].count).toBe(1); // short
    expect(result[1].count).toBe(1); // medium
    expect(result[2].count).toBe(1); // long
  });

  it("treats null text_preview as length 0 (short)", () => {
    const posts = [makePost("TEXT", 0, { text_preview: null })];
    const result = computeTextLengthBuckets(posts);
    expect(result[0].count).toBe(1); // short
  });

  it("boundary: 50 chars is short, 51 is medium", () => {
    const posts = [makePost("TEXT", 50), makePost("TEXT", 51)];
    const result = computeTextLengthBuckets(posts);
    expect(result[0].count).toBe(1); // short (50)
    expect(result[1].count).toBe(1); // medium (51)
  });

  it("boundary: 150 chars is medium, 151 is long", () => {
    const posts = [makePost("TEXT", 150), makePost("TEXT", 151)];
    const result = computeTextLengthBuckets(posts);
    expect(result[1].count).toBe(1); // medium (150)
    expect(result[2].count).toBe(1); // long (151)
  });

  it("computes engagement rate as (likes+replies+reposts+quotes+shares)/views * 100", () => {
    const posts = [
      makePost("TEXT", 30, {
        views: 1000,
        likes: 50,
        replies: 10,
        reposts: 5,
        quotes: 2,
        shares: 3,
      }),
    ];
    const result = computeTextLengthBuckets(posts);
    // (50+10+5+2+3)/1000 * 100 = 7
    expect(result[0].avgEngagementRate).toBeCloseTo(7);
  });

  it("returns 0 engagement rate when views is 0", () => {
    const posts = [makePost("TEXT", 30, { views: 0 })];
    const result = computeTextLengthBuckets(posts);
    expect(result[0].avgEngagementRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateFormatRecommendation
// ---------------------------------------------------------------------------

describe("generateFormatRecommendation", () => {
  it("returns null when fewer than MIN_POSTS_FOR_ANALYSIS posts", () => {
    const posts = [makePost("TEXT", 100), makePost("IMAGE", 100)];
    expect(generateFormatRecommendation(posts)).toBeNull();
  });

  it("returns null when all posts are the same media type", () => {
    const posts = Array.from({ length: 6 }, () => makePost("TEXT", 100));
    expect(generateFormatRecommendation(posts)).toBeNull();
  });

  it("returns formatComparison with percentage when types differ in WES", () => {
    const posts = [
      // IMAGE posts with high engagement
      makePost("IMAGE", 100, { views: 1000, likes: 100, replies: 20, reposts: 10, quotes: 5, shares: 10 }),
      makePost("IMAGE", 100, { views: 1000, likes: 100, replies: 20, reposts: 10, quotes: 5, shares: 10 }),
      makePost("IMAGE", 100, { views: 1000, likes: 100, replies: 20, reposts: 10, quotes: 5, shares: 10 }),
      // TEXT posts with lower engagement
      makePost("TEXT", 100, { views: 1000, likes: 10, replies: 1, reposts: 0, quotes: 0, shares: 0 }),
      makePost("TEXT", 100, { views: 1000, likes: 10, replies: 1, reposts: 0, quotes: 0, shares: 0 }),
    ];
    const result = generateFormatRecommendation(posts);
    expect(result).not.toBeNull();
    expect(result!.formatComparison).toContain("IMAGE");
    expect(result!.formatComparison).toContain("TEXT");
    expect(result!.formatComparison).toContain("%");
  });

  it("returns lengthComparison when buckets differ", () => {
    const posts = [
      // Long posts with high engagement
      makePost("IMAGE", 200, { views: 1000, likes: 100, replies: 20, reposts: 10, quotes: 5, shares: 10 }),
      makePost("IMAGE", 200, { views: 1000, likes: 100, replies: 20, reposts: 10, quotes: 5, shares: 10 }),
      makePost("TEXT", 200, { views: 1000, likes: 100, replies: 20, reposts: 10, quotes: 5, shares: 10 }),
      // Short posts with lower engagement
      makePost("TEXT", 30, { views: 1000, likes: 10, replies: 1, reposts: 0, quotes: 0, shares: 0 }),
      makePost("TEXT", 30, { views: 1000, likes: 10, replies: 1, reposts: 0, quotes: 0, shares: 0 }),
    ];
    const result = generateFormatRecommendation(posts);
    expect(result).not.toBeNull();
    expect(result!.lengthComparison).not.toBeNull();
    expect(result!.lengthComparison).toContain("%");
  });

  it("returns null lengthComparison when all posts are same length bucket", () => {
    const posts = [
      makePost("IMAGE", 100, { views: 1000, likes: 100 }),
      makePost("IMAGE", 100, { views: 1000, likes: 100 }),
      makePost("IMAGE", 100, { views: 1000, likes: 100 }),
      makePost("TEXT", 100, { views: 1000, likes: 10 }),
      makePost("TEXT", 100, { views: 1000, likes: 10 }),
    ];
    const result = generateFormatRecommendation(posts);
    expect(result).not.toBeNull();
    expect(result!.lengthComparison).toBeNull();
  });

  it("says 'perform similarly' when best and worst WES are equal", () => {
    const posts = [
      makePost("IMAGE", 100, { views: 1000, likes: 50, replies: 10, reposts: 5, quotes: 2, shares: 3 }),
      makePost("IMAGE", 100, { views: 1000, likes: 50, replies: 10, reposts: 5, quotes: 2, shares: 3 }),
      makePost("TEXT", 100, { views: 1000, likes: 50, replies: 10, reposts: 5, quotes: 2, shares: 3 }),
      makePost("TEXT", 100, { views: 1000, likes: 50, replies: 10, reposts: 5, quotes: 2, shares: 3 }),
      makePost("TEXT", 100, { views: 1000, likes: 50, replies: 10, reposts: 5, quotes: 2, shares: 3 }),
    ];
    const result = generateFormatRecommendation(posts);
    expect(result).not.toBeNull();
    expect(result!.formatComparison).toContain("perform similarly");
  });
});
