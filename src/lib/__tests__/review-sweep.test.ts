import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  generate: vi.fn(),
  resolveLLMClient: vi.fn(),
  loadPrompt: vi.fn((name: string) => `PROMPT:${name}`),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

vi.mock("@/lib/llm-resolver", () => ({
  resolveLLMClient: mocks.resolveLLMClient,
}));

vi.mock("@/lib/prompts/loader", () => ({
  loadPrompt: mocks.loadPrompt,
}));

import {
  BAND_VERDICTS,
  buildReviewNarrativePrompt,
  classifyBand,
  DEFAULT_BATCH_SIZE,
  fetchWindowedMetrics,
  firstSentence,
  isDegenerateRange,
  processPrediction,
  runReviewSweep,
} from "../review-sweep";

// ── Pure helpers ─────────────────────────────────────────────────────

describe("classifyBand", () => {
  const ranges = { p25: 100, p50: 200, p75: 400 };

  it("returns below_conservative below p25", () => {
    expect(classifyBand(50, ranges)).toBe("below_conservative");
    expect(classifyBand(99, ranges)).toBe("below_conservative");
  });

  it("returns conservative between p25 and the baseline band", () => {
    expect(classifyBand(100, ranges)).toBe("conservative");
    expect(classifyBand(150, ranges)).toBe("conservative");
  });

  it("returns baseline inside the epsilon window around p50", () => {
    // iqr=300 → epsilon=max(1, 15)=15 → baseline band is [185, 215]
    expect(classifyBand(185, ranges)).toBe("baseline");
    expect(classifyBand(200, ranges)).toBe("baseline");
    expect(classifyBand(215, ranges)).toBe("baseline");
  });

  it("returns optimistic between baseline and p75", () => {
    expect(classifyBand(216, ranges)).toBe("optimistic");
    expect(classifyBand(400, ranges)).toBe("optimistic");
  });

  it("returns above_optimistic above p75", () => {
    expect(classifyBand(401, ranges)).toBe("above_optimistic");
    expect(classifyBand(10_000, ranges)).toBe("above_optimistic");
  });

  it("handles tiny IQR without collapsing bands", () => {
    // iqr=1 but epsilon floors to 1, so baseline band is [4, 6]
    const tiny = { p25: 4, p50: 5, p75: 5 };
    expect(classifyBand(3, tiny)).toBe("below_conservative");
    expect(classifyBand(4, tiny)).toBe("baseline");
    expect(classifyBand(5, tiny)).toBe("baseline");
    expect(classifyBand(6, tiny)).toBe("baseline");
    expect(classifyBand(7, tiny)).toBe("above_optimistic");
  });

  it("covers all five literal verdicts", () => {
    expect(BAND_VERDICTS).toEqual([
      "below_conservative",
      "conservative",
      "baseline",
      "optimistic",
      "above_optimistic",
    ]);
  });
});

describe("isDegenerateRange", () => {
  it("is true when all three percentiles are equal", () => {
    expect(isDegenerateRange({ p25: 0, p50: 0, p75: 0 })).toBe(true);
    expect(isDegenerateRange({ p25: 42, p50: 42, p75: 42 })).toBe(true);
  });

  it("is false when any percentile differs", () => {
    expect(isDegenerateRange({ p25: 1, p50: 2, p75: 3 })).toBe(false);
    expect(isDegenerateRange({ p25: 0, p50: 0, p75: 1 })).toBe(false);
  });
});

describe("firstSentence", () => {
  it("extracts the first sentence ending in a terminator", () => {
    expect(firstSentence("Key learning. More detail.")).toBe("Key learning.");
    expect(firstSentence("It beat baseline! Drivers: …")).toBe(
      "It beat baseline!",
    );
    expect(firstSentence("Why did this miss?")).toBe("Why did this miss?");
  });

  it("falls back to the full string when no terminator is present", () => {
    expect(firstSentence("no terminator here")).toBe("no terminator here");
  });
});

// ── Prompt builder ───────────────────────────────────────────────────

describe("buildReviewNarrativePrompt", () => {
  const baseInput = {
    postText: "Just shipped a thing.",
    permalink: "https://threads.net/p/1",
    topicTag: "ship",
    ranges: {
      p25: 100,
      p50: 300,
      p75: 700,
      matchedCount: 12,
      confidence: "medium" as const,
    },
    driverFactors: { hook: "information_gap" },
    actual: {
      views: 950,
      likes: 40,
      replies: 8,
      reposts: 2,
      quotes: 1,
      shares: 3,
      fetched_at: "2026-04-24T12:00:00Z",
      source: "windowed_24h" as const,
    },
    verdict: "above_optimistic" as const,
  };

  it("orders knowledge blocks as [algorithm, psychology, review-narrative] and marks them cacheable", () => {
    const { systemPrompt } = buildReviewNarrativePrompt(baseInput);
    expect(systemPrompt).toHaveLength(3);
    expect(systemPrompt[0]).toEqual({ text: "PROMPT:algorithm", cacheable: true });
    expect(systemPrompt[1]).toEqual({ text: "PROMPT:psychology", cacheable: true });
    expect(systemPrompt[2]).toEqual({
      text: "PROMPT:review-narrative",
      cacheable: true,
    });
  });

  it("includes the verdict, post text, predicted range, and actual metrics in the user message", () => {
    const { userMessage } = buildReviewNarrativePrompt(baseInput);
    expect(userMessage).toContain("Just shipped a thing.");
    expect(userMessage).toContain("Band verdict: above_optimistic");
    expect(userMessage).toContain("p50 (baseline): 300");
    expect(userMessage).toContain("views: 950");
    expect(userMessage).toContain("snapshot source: windowed_24h");
    expect(userMessage).toContain("information_gap");
  });
});

// ── fetchWindowedMetrics ─────────────────────────────────────────────

interface SnapshotResponse {
  data: Record<string, number | string | null> | null;
  error: unknown;
}

function makeMetricsChain(
  windowResponse: SnapshotResponse,
  latestResponse?: SnapshotResponse,
) {
  let selectCall = 0;

  const selectChain = (orderAscending: boolean) => ({
    eq: () => {
      if (orderAscending) {
        return {
          gte: () => ({
            lte: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve(windowResponse),
                }),
              }),
            }),
          }),
        };
      }
      return {
        order: () => ({
          limit: () => ({
            maybeSingle: () =>
              Promise.resolve(latestResponse ?? { data: null, error: null }),
          }),
        }),
      };
    },
  });

  return {
    from: (table: string) => {
      expect(table).toBe("post_metrics");
      return {
        select: () => {
          selectCall += 1;
          return selectChain(selectCall === 1);
        },
      };
    },
  };
}

describe("fetchWindowedMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the in-window snapshot with source=windowed_24h", async () => {
    const chain = makeMetricsChain({
      data: {
        views: 500,
        likes: 20,
        replies: 5,
        reposts: 1,
        quotes: 0,
        shares: 2,
        fetched_at: "2026-04-24T12:00:00Z",
      },
      error: null,
    });
    mocks.from.mockImplementation(chain.from);

    const result = await fetchWindowedMetrics(
      "post-1",
      "2026-04-23T12:00:00Z",
    );
    expect(result.source).toBe("windowed_24h");
    expect(result.views).toBe(500);
    expect(result.fetched_at).toBe("2026-04-24T12:00:00Z");
  });

  it("falls back to the latest snapshot with source=latest when no in-window row exists", async () => {
    const chain = makeMetricsChain(
      { data: null, error: null },
      {
        data: {
          views: 88,
          likes: 3,
          replies: 1,
          reposts: 0,
          quotes: 0,
          shares: 0,
          fetched_at: "2026-04-25T00:00:00Z",
        },
        error: null,
      },
    );
    mocks.from.mockImplementation(chain.from);

    const result = await fetchWindowedMetrics(
      "post-1",
      "2026-04-23T12:00:00Z",
    );
    expect(result.source).toBe("latest");
    expect(result.views).toBe(88);
  });

  it("returns source=none when there are no snapshots at all", async () => {
    const chain = makeMetricsChain(
      { data: null, error: null },
      { data: null, error: null },
    );
    mocks.from.mockImplementation(chain.from);

    const result = await fetchWindowedMetrics(
      "post-1",
      "2026-04-23T12:00:00Z",
    );
    expect(result.source).toBe("none");
    expect(result.views).toBe(0);
    expect(result.fetched_at).toBeNull();
  });
});

// ── processPrediction ────────────────────────────────────────────────

function buildRow(overrides?: Partial<Parameters<typeof processPrediction>[0]>) {
  return {
    id: "prediction-1",
    user_id: "user-1",
    post_id: "post-1",
    draft_text_hash: "hash",
    draft_text: "draft",
    predicted_at: "2026-04-22T00:00:00Z",
    ranges: { p25: 100, p50: 200, p75: 400, matchedCount: 10, confidence: "medium" },
    driver_factors: { hook: "information_gap" },
    actual_windowed_metrics: null,
    review_state: "pending",
    reviewed_at: null,
    narrative: null,
    posts: {
      id: "post-1",
      published_at: "2026-04-22T00:00:00Z",
      text_full: "Full post body.",
      text_preview: "preview",
      permalink: "https://threads.net/p/1",
      topic_tag: "ship",
    },
    ...overrides,
  } as unknown as Parameters<typeof processPrediction>[0];
}

/**
 * Builds a `from()` mock where each table name maps to its own chain factory.
 * Keeps supabase-js's fluent API manageable — each scenario only implements
 * the chain steps it needs.
 */
function mockTables(config: Record<string, () => unknown>) {
  mocks.from.mockImplementation((table: string) => {
    const factory = config[table];
    if (!factory) {
      throw new Error(`Unexpected table in test: ${table}`);
    }
    return factory();
  });
}

describe("processPrediction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLLMClient.mockResolvedValue({
      generate: mocks.generate,
      generateStream: vi.fn(),
      generateStreamIterator: vi.fn(),
    });
  });

  it("discards with reason=post_deleted when the joined posts row is null", async () => {
    let updatePayload: Record<string, unknown> | undefined;

    mockTables({
      post_predictions: () => ({
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { id: "prediction-1" }, error: null }),
                }),
              }),
            }),
          };
        },
      }),
    });

    const result = await processPrediction(buildRow({ posts: null }));

    expect(result).toEqual({ status: "discarded", reason: "post_deleted" });
    expect(updatePayload?.review_state).toBe("discarded");
    expect(
      (updatePayload?.driver_factors as { discard_reason?: string }).discard_reason,
    ).toBe("post_deleted");
  });

  it("discards with reason=degenerate_range when p25=p50=p75", async () => {
    mockTables({
      post_predictions: () => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { id: "prediction-1" }, error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await processPrediction(
      buildRow({
        ranges: {
          p25: 0,
          p50: 0,
          p75: 0,
          matchedCount: 0,
          confidence: "low",
        },
      }),
    );
    expect(result).toEqual({ status: "discarded", reason: "degenerate_range" });
  });

  it("discards with reason=no_metrics when there are zero snapshots", async () => {
    let metricsSelectCount = 0;
    mockTables({
      post_metrics: () => ({
        select: () => {
          metricsSelectCount += 1;
          const ascending = metricsSelectCount === 1;
          return {
            eq: () =>
              ascending
                ? {
                    gte: () => ({
                      lte: () => ({
                        order: () => ({
                          limit: () => ({
                            maybeSingle: () =>
                              Promise.resolve({ data: null, error: null }),
                          }),
                        }),
                      }),
                    }),
                  }
                : {
                    order: () => ({
                      limit: () => ({
                        maybeSingle: () =>
                          Promise.resolve({ data: null, error: null }),
                      }),
                    }),
                  },
          };
        },
      }),
      post_predictions: () => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { id: "prediction-1" }, error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await processPrediction(buildRow());
    expect(result).toEqual({ status: "discarded", reason: "no_metrics" });
  });

  it("writes narrative and marks reviewed on the happy path", async () => {
    let metricsSelectCount = 0;
    let updatePayload: Record<string, unknown> | undefined;

    mockTables({
      post_metrics: () => ({
        select: () => {
          metricsSelectCount += 1;
          if (metricsSelectCount === 1) {
            return {
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: () =>
                          Promise.resolve({
                            data: {
                              views: 200,
                              likes: 10,
                              replies: 3,
                              reposts: 1,
                              quotes: 0,
                              shares: 0,
                              fetched_at: "2026-04-23T00:00:00Z",
                            },
                            error: null,
                          }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          throw new Error("unexpected second post_metrics select");
        },
      }),
      post_predictions: () => ({
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { id: "prediction-1" },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        },
      }),
    });

    mocks.generate.mockResolvedValue(
      "This post landed at baseline. Replies moved it up from conservative.",
    );

    const result = await processPrediction(buildRow());

    expect(result.status).toBe("reviewed");
    expect(mocks.resolveLLMClient).toHaveBeenCalledWith("user-1");
    expect(updatePayload?.narrative).toContain("This post landed at baseline.");
    expect(updatePayload?.review_state).toBe("reviewed");
    expect(
      (updatePayload?.actual_windowed_metrics as { band_verdict?: string })
        .band_verdict,
    ).toBe("baseline");
    expect(
      (updatePayload?.actual_windowed_metrics as { source?: string }).source,
    ).toBe("windowed_24h");
  });

  it("returns skipped when the conditional UPDATE matches zero rows", async () => {
    let metricsSelectCount = 0;

    mockTables({
      post_metrics: () => ({
        select: () => {
          metricsSelectCount += 1;
          return {
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: {
                            views: 250,
                            likes: 0,
                            replies: 0,
                            reposts: 0,
                            quotes: 0,
                            shares: 0,
                            fetched_at: "2026-04-23T00:00:00Z",
                          },
                          error: null,
                        }),
                    }),
                  }),
                }),
              }),
            }),
          };
        },
      }),
      post_predictions: () => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    mocks.generate.mockResolvedValue("Narrative text.");

    const result = await processPrediction(buildRow());
    expect(result).toEqual({ status: "skipped" });
    expect(metricsSelectCount).toBe(1);
  });

  it("bubbles LLM errors up for the sweep orchestrator to count", async () => {
    mockTables({
      post_metrics: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          views: 1,
                          likes: 0,
                          replies: 0,
                          reposts: 0,
                          quotes: 0,
                          shares: 0,
                          fetched_at: "2026-04-23T00:00:00Z",
                        },
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mocks.generate.mockRejectedValue(new Error("rate limited"));

    await expect(processPrediction(buildRow())).rejects.toThrow("rate limited");
  });
});

// ── runReviewSweep ───────────────────────────────────────────────────

describe("runReviewSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLLMClient.mockResolvedValue({
      generate: mocks.generate,
      generateStream: vi.fn(),
      generateStreamIterator: vi.fn(),
    });
  });

  it("returns a summary with zeros when there is nothing to process", async () => {
    let selectCalls = 0;

    mockTables({
      post_predictions: () => ({
        select: () => {
          selectCalls += 1;
          if (selectCalls === 1) {
            // bulk-discard pass
            return {
              eq: () => ({
                is: () => ({
                  lt: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            };
          }
          // review-candidate pass
          return {
            eq: () => ({
              not: () => ({
                lt: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        },
      }),
    });

    const summary = await runReviewSweep({ now: new Date("2026-04-23T00:00:00Z") });

    expect(summary.reviewed).toBe(0);
    expect(summary.discarded).toBe(0);
    expect(summary.errors).toBe(0);
    expect(summary.avgLlmMs).toBe(0);
    expect(typeof summary.durationMs).toBe("number");
    expect(summary.aborted).toBeUndefined();
  });

  it("uses the default batch size of 50", () => {
    expect(DEFAULT_BATCH_SIZE).toBe(50);
  });
});
