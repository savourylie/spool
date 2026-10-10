import { describe, expect, it, vi } from "vitest";
import { getLatestReview } from "../latest-review";

function buildSupabaseStub(row: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const not2 = vi.fn().mockReturnValue({ order });
  const not1 = vi.fn().mockReturnValue({ not: not2 });
  const eq2 = vi.fn().mockReturnValue({ not: not1 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as Parameters<typeof getLatestReview>[0];
}

const baseRow = {
  id: "pred-1",
  post_id: "post-1",
  draft_text: "fallback draft",
  narrative:
    "Strong reply velocity in the first three hours pushed this above the band. Opening line teased a payoff.",
  reviewed_at: "2026-04-24T00:00:00Z",
  ranges: {
    p25: 500,
    p50: 1000,
    p75: 2000,
    matchedCount: 12,
    confidence: "medium",
  },
  actual_windowed_metrics: {
    views: 3000,
    likes: 100,
    replies: 20,
    reposts: 5,
    quotes: 1,
    shares: 2,
    fetched_at: "2026-04-23T00:00:00Z",
    source: "windowed_24h",
  },
  posts: {
    text_preview: "A post about thinking in systems.",
    permalink: "https://threads.com/post-1",
    media_type: "TEXT_POST",
    published_at: "2026-04-22T00:00:00Z",
  },
};

describe("getLatestReview", () => {
  it("returns a typed result with key learning and verdict when data is present", async () => {
    const supabase = buildSupabaseStub(baseRow);
    const result = await getLatestReview(supabase, "user-1");
    expect(result).not.toBeNull();
    expect(result!.predictionId).toBe("pred-1");
    expect(result!.verdict).toBe("above_optimistic");
    expect(result!.textPreview).toBe("A post about thinking in systems.");
    expect(result!.keyLearning).toBe(
      "Strong reply velocity in the first three hours pushed this above the band.",
    );
    expect(result!.matchedCount).toBe(12);
  });

  it("falls back to draft_text when the joined post has no preview", async () => {
    const supabase = buildSupabaseStub({
      ...baseRow,
      posts: { ...baseRow.posts, text_preview: null },
    });
    const result = await getLatestReview(supabase, "user-1");
    expect(result!.textPreview).toBe("fallback draft");
  });

  it("returns null when the query errors", async () => {
    const supabase = buildSupabaseStub(null, { message: "boom" });
    const result = await getLatestReview(supabase, "user-1");
    expect(result).toBeNull();
  });

  it("returns null when no reviewed row exists", async () => {
    const supabase = buildSupabaseStub(null);
    const result = await getLatestReview(supabase, "user-1");
    expect(result).toBeNull();
  });

  it("returns null when ranges are unparseable", async () => {
    const supabase = buildSupabaseStub({
      ...baseRow,
      ranges: { broken: true },
    });
    const result = await getLatestReview(supabase, "user-1");
    expect(result).toBeNull();
  });

  it("returns null when actual metrics are missing views", async () => {
    const supabase = buildSupabaseStub({
      ...baseRow,
      actual_windowed_metrics: { likes: 10 },
    });
    const result = await getLatestReview(supabase, "user-1");
    expect(result).toBeNull();
  });

  it("classifies below-range actuals as below_conservative", async () => {
    const supabase = buildSupabaseStub({
      ...baseRow,
      actual_windowed_metrics: { ...baseRow.actual_windowed_metrics, views: 200 },
    });
    const result = await getLatestReview(supabase, "user-1");
    expect(result!.verdict).toBe("below_conservative");
  });
});
