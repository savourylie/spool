import { describe, it, expect, vi, beforeEach } from "vitest";

import type { BandVerdict } from "@/lib/review-sweep";

// ── Supabase mock ────────────────────────────────────────────────────
// Flexible mock: each test sets `mockData` which is returned once the
// full chain resolves. `capturedChain` records the call sequence so tests
// can assert on filters.

let mockData: unknown = [];
let mockCount: number | null = null;
let mockError: { message: string } | null = null;
const capturedChain: Array<{ method: string; args: unknown[] }> = [];

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (col: string, val: unknown) => QueryBuilder;
  gte: (col: string, val: unknown) => QueryBuilder;
  order: (col: string, opts?: unknown) => QueryBuilder;
  range: (from: number, to: number) => Promise<{
    data: unknown;
    error: unknown;
    count: number | null;
  }>;
  then: (
    resolve: (v: {
      data: unknown;
      error: unknown;
      count: number | null;
    }) => unknown,
  ) => Promise<unknown>;
};

function createBuilder(): QueryBuilder {
  const builder: QueryBuilder = {
    select: (...args: unknown[]) => {
      capturedChain.push({ method: "select", args });
      return builder;
    },
    eq: (col: string, val: unknown) => {
      capturedChain.push({ method: "eq", args: [col, val] });
      return builder;
    },
    gte: (col: string, val: unknown) => {
      capturedChain.push({ method: "gte", args: [col, val] });
      return builder;
    },
    order: (col: string, opts?: unknown) => {
      capturedChain.push({ method: "order", args: [col, opts] });
      return builder;
    },
    range: (from: number, to: number) => {
      capturedChain.push({ method: "range", args: [from, to] });
      return Promise.resolve({
        data: mockError ? null : mockData,
        error: mockError,
        count: mockCount,
      });
    },
    then: (resolve) =>
      Promise.resolve({
        data: mockError ? null : mockData,
        error: mockError,
        count: mockCount,
      }).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      capturedChain.push({ method: "from", args: [table] });
      return createBuilder();
    },
  }),
}));

import {
  coerceActualMetrics,
  coerceRanges,
  computeBandDistribution,
  computeBaselineTrend,
  extractFreshnessReason,
} from "../prediction-reviews";

beforeEach(() => {
  mockData = [];
  mockCount = null;
  mockError = null;
  capturedChain.length = 0;
});

// ── Pure helpers ─────────────────────────────────────────────────────

describe("coerceRanges", () => {
  it("returns zeroed ranges for null", () => {
    expect(coerceRanges(null)).toEqual({
      p25: 0,
      p50: 0,
      p75: 0,
      matchedCount: 0,
      confidence: "low",
    });
  });

  it("returns zeroed ranges for array input", () => {
    expect(coerceRanges(["whoops"])).toEqual({
      p25: 0,
      p50: 0,
      p75: 0,
      matchedCount: 0,
      confidence: "low",
    });
  });

  it("parses a well-formed ranges object", () => {
    expect(
      coerceRanges({
        p25: 100,
        p50: 250,
        p75: 500,
        matchedCount: 12,
        confidence: "high",
      }),
    ).toEqual({
      p25: 100,
      p50: 250,
      p75: 500,
      matchedCount: 12,
      confidence: "high",
    });
  });

  it("coerces missing percentiles to zero without throwing", () => {
    const parsed = coerceRanges({ matchedCount: 3 });
    expect(parsed.p25).toBe(0);
    expect(parsed.p50).toBe(0);
    expect(parsed.p75).toBe(0);
    expect(parsed.confidence).toBe("low");
  });

  it("rejects unknown confidence strings", () => {
    expect(coerceRanges({ confidence: "very-high" }).confidence).toBe("low");
  });
});

describe("coerceActualMetrics", () => {
  const ranges = { p25: 100, p50: 300, p75: 600, matchedCount: 5, confidence: "medium" as const };

  it("returns null for null input", () => {
    expect(coerceActualMetrics(null, ranges)).toBeNull();
  });

  it("returns null when views is missing", () => {
    expect(coerceActualMetrics({ likes: 5 }, ranges)).toBeNull();
  });

  it("honors a valid stored band_verdict", () => {
    const out = coerceActualMetrics(
      {
        views: 250,
        likes: 10,
        replies: 2,
        reposts: 1,
        quotes: 0,
        shares: 3,
        fetched_at: "2026-04-23T12:00:00Z",
        source: "windowed_24h",
        band_verdict: "optimistic",
      },
      ranges,
    );
    expect(out?.bandVerdict).toBe("optimistic");
  });

  it("falls back to classifyBand when band_verdict is missing", () => {
    const out = coerceActualMetrics(
      {
        views: 50, // below p25 → below_conservative
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
        shares: 0,
        source: "windowed_24h",
      },
      ranges,
    );
    expect(out?.bandVerdict).toBe("below_conservative");
  });

  it("falls back to classifyBand when band_verdict is garbage", () => {
    const out = coerceActualMetrics(
      { views: 300, band_verdict: "not-a-band", source: "latest" },
      ranges,
    );
    expect(out?.bandVerdict).toBe("baseline");
    expect(out?.source).toBe("latest");
  });

  it("defaults source to 'none' for unknown values", () => {
    const out = coerceActualMetrics({ views: 100, source: "weird" }, ranges);
    expect(out?.source).toBe("none");
  });
});

// ── extractFreshnessReason ───────────────────────────────────────────

describe("extractFreshnessReason", () => {
  it("external-red only", () => {
    expect(
      extractFreshnessReason({
        external_signal: {
          saturation: "red",
          topRelevance: 82,
          trendCount: 4,
          unavailable: false,
        },
        self_repetition_risk: {
          severity: "none",
          matchedCluster: null,
          matchedTag: null,
          counts: { d7: 0, d14: 0, d30: 0 },
        },
      }),
    ).toBe("External: saturated topic");
  });

  it("self-high only", () => {
    expect(
      extractFreshnessReason({
        external_signal: {
          saturation: "green",
          topRelevance: 10,
          trendCount: 0,
          unavailable: false,
        },
        self_repetition_risk: {
          severity: "high",
          matchedCluster: "AI agents",
          matchedTag: "ai-agents",
          counts: { d7: 3, d14: 5, d30: 8 },
        },
      }),
    ).toBe("Self: AI agents (3× last 7d)");
  });

  it("both red", () => {
    expect(
      extractFreshnessReason({
        external_signal: {
          saturation: "red",
          topRelevance: 90,
          trendCount: 10,
          unavailable: false,
        },
        self_repetition_risk: {
          severity: "high",
          matchedCluster: "Build in public",
          matchedTag: "build-in-public",
          counts: { d7: 4, d14: 6, d30: 10 },
        },
      }),
    ).toBe("External saturation + self-repetition");
  });

  it("neither red (defensive)", () => {
    expect(
      extractFreshnessReason({
        external_signal: null,
        self_repetition_risk: null,
      }),
    ).toBe("Flagged");
  });

  it("self-high with missing cluster still renders something", () => {
    expect(
      extractFreshnessReason({
        external_signal: null,
        self_repetition_risk: {
          severity: "high",
          matchedCluster: null,
          matchedTag: null,
          counts: { d7: 0, d14: 0, d30: 0 },
        },
      }),
    ).toBe("Self: similar topic");
  });
});

// ── computeBandDistribution ──────────────────────────────────────────

describe("computeBandDistribution", () => {
  it("counts mixed bands", async () => {
    mockData = [
      { actual_windowed_metrics: { band_verdict: "baseline" } },
      { actual_windowed_metrics: { band_verdict: "baseline" } },
      { actual_windowed_metrics: { band_verdict: "optimistic" } },
      { actual_windowed_metrics: { band_verdict: "below_conservative" } },
    ];
    const out = await computeBandDistribution("user-1");
    expect(out.total).toBe(4);
    expect(out.counts.baseline).toBe(2);
    expect(out.counts.optimistic).toBe(1);
    expect(out.counts.below_conservative).toBe(1);
    expect(out.counts.above_optimistic).toBe(0);
  });

  it("skips rows missing band_verdict", async () => {
    mockData = [
      { actual_windowed_metrics: { band_verdict: "baseline" } },
      { actual_windowed_metrics: { views: 42 } },
      { actual_windowed_metrics: null },
      { actual_windowed_metrics: { band_verdict: "weird-value" } },
    ];
    const out = await computeBandDistribution("user-1");
    expect(out.total).toBe(1);
    expect(out.counts.baseline).toBe(1);
  });

  it("returns zeros on DB error", async () => {
    mockError = { message: "boom" };
    const out = await computeBandDistribution("user-1");
    expect(out.total).toBe(0);
  });

  it("returns zeros on empty userId", async () => {
    const out = await computeBandDistribution("");
    expect(out.total).toBe(0);
  });
});

// ── computeBaselineTrend ─────────────────────────────────────────────

function makeTrendRow(
  reviewedAt: string,
  band: BandVerdict,
): { reviewed_at: string; actual_windowed_metrics: { band_verdict: string } } {
  return {
    reviewed_at: reviewedAt,
    actual_windowed_metrics: { band_verdict: band },
  };
}

describe("computeBaselineTrend", () => {
  const now = new Date("2026-04-30T12:00:00Z");

  function iso(daysAgo: number): string {
    return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  }

  it("returns null when last-30 has fewer than 5 reviews", async () => {
    mockData = [
      makeTrendRow(iso(1), "baseline"),
      ...Array.from({ length: 10 }, (_, i) => makeTrendRow(iso(40 + i), "baseline")),
    ];
    const out = await computeBaselineTrend("user-1", now);
    expect(out).toBeNull();
  });

  it("returns null when prior-30 has fewer than 5 reviews", async () => {
    mockData = [
      ...Array.from({ length: 8 }, (_, i) => makeTrendRow(iso(i + 1), "baseline")),
      makeTrendRow(iso(40), "baseline"),
    ];
    const out = await computeBaselineTrend("user-1", now);
    expect(out).toBeNull();
  });

  it("returns 'up' when last-30 baseline-pct higher than prior-30", async () => {
    mockData = [
      // last 30: 5/5 baseline → 100%
      makeTrendRow(iso(1), "baseline"),
      makeTrendRow(iso(3), "baseline"),
      makeTrendRow(iso(7), "baseline"),
      makeTrendRow(iso(14), "baseline"),
      makeTrendRow(iso(25), "baseline"),
      // prior 30: 2/5 baseline → 40%
      makeTrendRow(iso(31), "baseline"),
      makeTrendRow(iso(35), "baseline"),
      makeTrendRow(iso(40), "optimistic"),
      makeTrendRow(iso(45), "conservative"),
      makeTrendRow(iso(50), "optimistic"),
    ];
    const out = await computeBaselineTrend("user-1", now);
    expect(out).not.toBeNull();
    expect(out!.direction).toBe("up");
    expect(Math.round(out!.last30Pct)).toBe(100);
    expect(Math.round(out!.prior30Pct)).toBe(40);
    expect(out!.deltaPct).toBeGreaterThan(0);
  });

  it("returns 'down' when last-30 baseline-pct lower than prior-30", async () => {
    mockData = [
      // last 30: 1/5 → 20%
      makeTrendRow(iso(1), "baseline"),
      makeTrendRow(iso(3), "optimistic"),
      makeTrendRow(iso(7), "optimistic"),
      makeTrendRow(iso(14), "optimistic"),
      makeTrendRow(iso(25), "optimistic"),
      // prior 30: 4/5 → 80%
      makeTrendRow(iso(31), "baseline"),
      makeTrendRow(iso(35), "baseline"),
      makeTrendRow(iso(40), "baseline"),
      makeTrendRow(iso(45), "baseline"),
      makeTrendRow(iso(50), "optimistic"),
    ];
    const out = await computeBaselineTrend("user-1", now);
    expect(out!.direction).toBe("down");
    expect(out!.deltaPct).toBeLessThan(0);
  });

  it("returns 'flat' when delta is under 1 percentage point", async () => {
    // Build 100 rows per window, flip exactly 1 baseline → keeps deltaPct ≈ 1 pp
    const last30: unknown[] = Array.from({ length: 100 }, (_, i) =>
      makeTrendRow(iso(1 + (i % 25)), i < 50 ? "baseline" : "optimistic"),
    );
    const prior30: unknown[] = Array.from({ length: 100 }, (_, i) =>
      makeTrendRow(iso(31 + (i % 25)), i < 50 ? "baseline" : "optimistic"),
    );
    mockData = [...last30, ...prior30];
    const out = await computeBaselineTrend("user-1", now);
    expect(out!.direction).toBe("flat");
  });

  it("returns null on DB error", async () => {
    mockError = { message: "boom" };
    const out = await computeBaselineTrend("user-1", now);
    expect(out).toBeNull();
  });
});
