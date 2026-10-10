import { describe, expect, it } from "vitest";
import {
  MIN_POSTS_FOR_PREDICTION,
  MIN_MATCHED_POSTS,
  HOUR_BUCKET_TOLERANCE,
  LLM_MULTIPLIER_MIN,
  LLM_MULTIPLIER_MAX,
  getTextLengthBucket,
  isInHourBucket,
  computePercentile,
  formatNumber,
  predictEngagement,
  parsePredictionRefinement,
  applyLLMRefinement,
  type HistoricalPost,
  type PostCharacteristics,
} from "../engagement-prediction";

// ── Fixture Factory ──────────────────────────────────────────────────

function makePost(overrides: Partial<HistoricalPost> = {}): HistoricalPost {
  return {
    views: 1000,
    media_type: "TEXT",
    text_length: 100,
    published_at: "2026-03-14T12:00:00Z", // Saturday, noon UTC
    topic_tag: null,
    ...overrides,
  };
}

function makeCharacteristics(
  overrides: Partial<PostCharacteristics> = {},
): PostCharacteristics {
  return {
    mediaType: "TEXT",
    textLength: 100,
    dayOfWeek: 6, // Saturday (matches fixture)
    hourOfDay: 12, // noon (matches fixture)
    ...overrides,
  };
}

function makePosts(
  count: number,
  overrides: Partial<HistoricalPost> = {},
): HistoricalPost[] {
  return Array.from({ length: count }, (_, i) =>
    makePost({ views: (i + 1) * 100, ...overrides }),
  );
}

// ── Constants ────────────────────────────────────────────────────────

describe("Constants", () => {
  it("MIN_POSTS_FOR_PREDICTION is 10", () => {
    expect(MIN_POSTS_FOR_PREDICTION).toBe(10);
  });

  it("MIN_MATCHED_POSTS is 5", () => {
    expect(MIN_MATCHED_POSTS).toBe(5);
  });

  it("HOUR_BUCKET_TOLERANCE is 2", () => {
    expect(HOUR_BUCKET_TOLERANCE).toBe(2);
  });
});

// ── getTextLengthBucket ──────────────────────────────────────────────

describe("getTextLengthBucket", () => {
  it("classifies 0-50 as short", () => {
    expect(getTextLengthBucket(0)).toBe("short");
    expect(getTextLengthBucket(25)).toBe("short");
    expect(getTextLengthBucket(50)).toBe("short");
  });

  it("classifies 51-150 as medium", () => {
    expect(getTextLengthBucket(51)).toBe("medium");
    expect(getTextLengthBucket(100)).toBe("medium");
    expect(getTextLengthBucket(150)).toBe("medium");
  });

  it("classifies 151+ as long", () => {
    expect(getTextLengthBucket(151)).toBe("long");
    expect(getTextLengthBucket(300)).toBe("long");
    expect(getTextLengthBucket(1000)).toBe("long");
  });
});

// ── isInHourBucket ───────────────────────────────────────────────────

describe("isInHourBucket", () => {
  it("returns true for exact match", () => {
    expect(isInHourBucket(12, 12, 2)).toBe(true);
  });

  it("returns true within tolerance", () => {
    expect(isInHourBucket(10, 12, 2)).toBe(true);
    expect(isInHourBucket(14, 12, 2)).toBe(true);
  });

  it("returns false outside tolerance", () => {
    expect(isInHourBucket(9, 12, 2)).toBe(false);
    expect(isInHourBucket(15, 12, 2)).toBe(false);
  });

  it("wraps around midnight: hour 23 matches target 1 with tolerance 2", () => {
    expect(isInHourBucket(23, 1, 2)).toBe(true);
  });

  it("wraps around midnight: hour 0 matches target 22 with tolerance 2", () => {
    expect(isInHourBucket(0, 22, 2)).toBe(true);
  });

  it("wraps around midnight: hour 1 does not match target 22 with tolerance 2", () => {
    expect(isInHourBucket(1, 22, 2)).toBe(false);
  });
});

// ── computePercentile ────────────────────────────────────────────────

describe("computePercentile", () => {
  it("returns 0 for empty array", () => {
    expect(computePercentile([], 50)).toBe(0);
  });

  it("returns the single value for 1-element array", () => {
    expect(computePercentile([500], 25)).toBe(500);
    expect(computePercentile([500], 50)).toBe(500);
    expect(computePercentile([500], 75)).toBe(500);
  });

  it("interpolates for 5 evenly spaced values", () => {
    const values = [100, 200, 300, 400, 500];
    expect(computePercentile(values, 25)).toBe(200);
    expect(computePercentile(values, 50)).toBe(300);
    expect(computePercentile(values, 75)).toBe(400);
  });

  it("handles identical values", () => {
    const values = [1000, 1000, 1000];
    expect(computePercentile(values, 25)).toBe(1000);
    expect(computePercentile(values, 50)).toBe(1000);
    expect(computePercentile(values, 75)).toBe(1000);
  });

  it("returns min at 0th percentile", () => {
    expect(computePercentile([10, 20, 30], 0)).toBe(10);
  });

  it("returns max at 100th percentile", () => {
    expect(computePercentile([10, 20, 30], 100)).toBe(30);
  });
});

// ── formatNumber ─────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("returns raw number for values under 1000", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(500)).toBe("500");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats thousands as K", () => {
    expect(formatNumber(1000)).toBe("1.0K");
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(12345)).toBe("12.3K");
  });

  it("formats millions as M", () => {
    expect(formatNumber(1000000)).toBe("1.0M");
    expect(formatNumber(1500000)).toBe("1.5M");
    expect(formatNumber(25000000)).toBe("25.0M");
  });
});

// ── predictEngagement ────────────────────────────────────────────────

describe("predictEngagement", () => {
  describe("insufficient data", () => {
    it("returns insufficient_data with 0 posts", () => {
      const result = predictEngagement([], makeCharacteristics());
      expect(result).toEqual({
        status: "insufficient_data",
        totalPosts: 0,
        required: MIN_POSTS_FOR_PREDICTION,
      });
    });

    it("returns insufficient_data with 9 posts", () => {
      const result = predictEngagement(makePosts(9), makeCharacteristics());
      expect(result).toEqual({
        status: "insufficient_data",
        totalPosts: 9,
        required: MIN_POSTS_FOR_PREDICTION,
      });
    });

    it("returns ok with exactly 10 posts", () => {
      const result = predictEngagement(makePosts(10), makeCharacteristics());
      expect(result.status).toBe("ok");
    });
  });

  describe("tier matching", () => {
    it("tier 1 (full match): high confidence when media/day/hour/length all match", () => {
      // All posts match: TEXT, Saturday, noon, medium length
      const posts = makePosts(10);
      const result = predictEngagement(posts, makeCharacteristics());
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.range.confidence).toBe("high");
        expect(result.range.matchedCount).toBe(10);
      }
    });

    it("tier 2 (drop hour): high confidence when hour doesn't match", () => {
      // Posts at various hours but same day/type/length (all on Saturday March 14)
      const posts = Array.from({ length: 10 }, (_, i) =>
        makePost({
          views: (i + 1) * 100,
          published_at: `2026-03-14T${String(i * 2).padStart(2, "0")}:00:00Z`,
        }),
      );
      // Target hour 20 — only 1-2 posts within ±2 hours (18, 20),
      // so tier 1 fails but tier 2 (same day + length) succeeds
      const chars = makeCharacteristics({ hourOfDay: 20 });
      const result = predictEngagement(posts, chars);
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.range.confidence).toBe("high");
      }
    });

    it("tier 3 (drop day): medium confidence when day doesn't match", () => {
      // Posts on different days of the week, same type + length
      const posts = Array.from({ length: 10 }, (_, i) => {
        const day = 10 + i; // March 10-19 = various days of week
        return makePost({
          views: (i + 1) * 100,
          published_at: `2026-03-${String(day).padStart(2, "0")}T12:00:00Z`,
        });
      });
      // Target: Sunday at noon — most posts aren't on Sunday, tier 1+2 fail
      const chars = makeCharacteristics({ dayOfWeek: 0 });
      const result = predictEngagement(posts, chars);
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(["medium", "low"]).toContain(result.range.confidence);
      }
    });

    it("tier 4 (media only): low confidence when type matches but nothing else", () => {
      // Posts with same media type but different lengths and times
      const posts = Array.from({ length: 10 }, (_, i) =>
        makePost({
          views: (i + 1) * 100,
          text_length: 200 + i * 10, // all "long" bucket
          published_at: `2026-03-${String(10 + i).padStart(2, "0")}T${String(i * 2).padStart(2, "0")}:00:00Z`,
        }),
      );
      // Target: short text, different day/hour — only media type matches
      const chars = makeCharacteristics({
        textLength: 30,
        dayOfWeek: 0,
        hourOfDay: 23,
      });
      const result = predictEngagement(posts, chars);
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.range.confidence).toBe("low");
      }
    });

    it("tier 5 (global fallback): low confidence when media type doesn't match", () => {
      const posts = makePosts(10, { media_type: "IMAGE" });
      const chars = makeCharacteristics({ mediaType: "VIDEO" });
      const result = predictEngagement(posts, chars);
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.range.confidence).toBe("low");
        expect(result.range.matchedCount).toBe(10);
      }
    });
  });

  describe("percentile values", () => {
    it("computes reasonable percentiles from varied views", () => {
      const posts = Array.from({ length: 10 }, (_, i) =>
        makePost({ views: (i + 1) * 1000 }),
      );
      const result = predictEngagement(posts, makeCharacteristics());
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.range.p25).toBeLessThan(result.range.p50);
        expect(result.range.p50).toBeLessThan(result.range.p75);
      }
    });

    it("returns equal percentiles when all views are the same", () => {
      const posts = makePosts(10, { views: 5000 });
      const result = predictEngagement(posts, makeCharacteristics());
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.range.p25).toBe(5000);
        expect(result.range.p50).toBe(5000);
        expect(result.range.p75).toBe(5000);
      }
    });

    it("returns rounded integers", () => {
      const posts = Array.from({ length: 10 }, (_, i) =>
        makePost({ views: i * 333 + 1 }),
      );
      const result = predictEngagement(posts, makeCharacteristics());
      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(Number.isInteger(result.range.p25)).toBe(true);
        expect(Number.isInteger(result.range.p50)).toBe(true);
        expect(Number.isInteger(result.range.p75)).toBe(true);
      }
    });
  });
});

// ── parsePredictionRefinement ────────────────────────────────────────

describe("parsePredictionRefinement", () => {
  it("parses valid JSON", () => {
    const raw = JSON.stringify({ multiplier: 1.2, reasoning: "Good hook." });
    const result = parsePredictionRefinement(raw);
    expect(result.multiplier).toBe(1.2);
    expect(result.reasoning).toBe("Good hook.");
  });

  it("strips markdown fences", () => {
    const raw = '```json\n{"multiplier": 0.8, "reasoning": "Weak."}\n```';
    const result = parsePredictionRefinement(raw);
    expect(result.multiplier).toBe(0.8);
    expect(result.reasoning).toBe("Weak.");
  });

  it("clamps multiplier above max to 2.0", () => {
    const raw = JSON.stringify({ multiplier: 5.0, reasoning: "Viral!" });
    const result = parsePredictionRefinement(raw);
    expect(result.multiplier).toBe(LLM_MULTIPLIER_MAX);
  });

  it("clamps multiplier below min to 0.5", () => {
    const raw = JSON.stringify({ multiplier: 0.1, reasoning: "Poor." });
    const result = parsePredictionRefinement(raw);
    expect(result.multiplier).toBe(LLM_MULTIPLIER_MIN);
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePredictionRefinement("not json")).toThrow();
  });

  it("throws on non-finite multiplier", () => {
    const raw = JSON.stringify({ multiplier: "abc", reasoning: "Bad." });
    expect(() => parsePredictionRefinement(raw)).toThrow("Invalid multiplier");
  });

  it("defaults reasoning to empty string if missing", () => {
    const raw = JSON.stringify({ multiplier: 1.0 });
    const result = parsePredictionRefinement(raw);
    expect(result.reasoning).toBe("");
  });
});

// ── applyLLMRefinement ───────────────────────────────────────────────

describe("applyLLMRefinement", () => {
  const baseRange = {
    p25: 100,
    p50: 200,
    p75: 300,
    matchedCount: 10,
    confidence: "high" as const,
  };

  it("applies multiplier correctly", () => {
    const result = applyLLMRefinement(baseRange, 1.5, "Great content.");
    expect(result.adjustedP25).toBe(150);
    expect(result.adjustedP50).toBe(300);
    expect(result.adjustedP75).toBe(450);
    expect(result.reasoning).toBe("Great content.");
  });

  it("clamps multiplier to max", () => {
    const result = applyLLMRefinement(baseRange, 3.0, "Clamped.");
    expect(result.adjustedP25).toBe(200);
    expect(result.adjustedP50).toBe(400);
    expect(result.adjustedP75).toBe(600);
  });

  it("clamps multiplier to min", () => {
    const result = applyLLMRefinement(baseRange, 0.1, "Clamped.");
    expect(result.adjustedP25).toBe(50);
    expect(result.adjustedP50).toBe(100);
    expect(result.adjustedP75).toBe(150);
  });

  it("rounds results to integers", () => {
    const range = { ...baseRange, p25: 111, p50: 222, p75: 333 };
    const result = applyLLMRefinement(range, 1.3, "Rounded.");
    expect(Number.isInteger(result.adjustedP25)).toBe(true);
    expect(Number.isInteger(result.adjustedP50)).toBe(true);
    expect(Number.isInteger(result.adjustedP75)).toBe(true);
  });

  it("multiplier 1.0 leaves values unchanged", () => {
    const result = applyLLMRefinement(baseRange, 1.0, "No change.");
    expect(result.adjustedP25).toBe(100);
    expect(result.adjustedP50).toBe(200);
    expect(result.adjustedP75).toBe(300);
  });
});
