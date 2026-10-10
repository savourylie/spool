import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface PostSeed {
  id: string;
  topic_tag: string | null;
  text_preview: string | null;
  permalink: string | null;
  published_at: string;
}

interface InsertCall {
  run_id: string;
  user_id: string;
  topic: string;
  verdict: string;
  external_signal: Record<string, unknown>;
  self_repetition_risk: Record<string, unknown>;
  sources: Array<Record<string, unknown>>;
}

let mockPosts: PostSeed[] = [];
let mockRateLimitCount = 0;
let mockRateLimitError: { message: string } | null = null;
let mockPostSelectError: { message: string } | null = null;
let mockInsertError: { message: string } | null = null;
const mockInsertCalls: InsertCall[] = [];

function resetMocks() {
  mockPosts = [];
  mockRateLimitCount = 0;
  mockRateLimitError = null;
  mockPostSelectError = null;
  mockInsertError = null;
  mockInsertCalls.length = 0;
  mockSearchTrends.mockReset();
  // Default: empty trends, available API.
  mockSearchTrends.mockResolvedValue({ trends: [], unavailable: false });
}

function createMockFrom(table: string) {
  if (table === "freshness_checks") {
    return {
      // Rate-limit probe: select('id', {count, head}).eq('user_id', ...).gte('created_at', ...)
      select: () => ({
        eq: () => ({
          gte: () =>
            Promise.resolve({
              data: null,
              count: mockRateLimitCount,
              error: mockRateLimitError,
            }),
        }),
      }),
      // Audit insert.
      insert: (row: InsertCall) => {
        mockInsertCalls.push(row);
        return Promise.resolve({ error: mockInsertError });
      },
    };
  }

  if (table === "posts") {
    return {
      select: () => ({
        eq: () => ({
          gte: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: mockPostSelectError ? null : mockPosts,
                  error: mockPostSelectError,
                }),
            }),
          }),
        }),
      }),
    };
  }

  return {};
}

// Search-trends mock
const mockSearchTrends = vi.fn();

vi.mock("@/lib/grok-search", () => ({
  searchTrends: (topics: string[]) => mockSearchTrends(topics),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

// Provide deterministic UUIDs for easier assertions.
const mockUuid = "00000000-0000-0000-0000-000000000042";
vi.mock("node:crypto", async () => {
  const actual =
    await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return {
    ...actual,
    randomUUID: () => mockUuid,
  };
});

// Import target after mocks so the mocks are wired at module-load time.
import {
  checkTopicFreshness,
  RateLimitError,
  MAX_CHECKS_PER_HOUR,
  EXTERNAL_SATURATION_RED,
  EXTERNAL_SATURATION_YELLOW,
  MAX_TOPIC_LENGTH,
  SURPRISE_ME_SENTINEL,
} from "../freshness-gate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER = "user-123";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function seedPost(
  id: string,
  topicTag: string | null,
  daysAgo: number,
): PostSeed {
  return {
    id,
    topic_tag: topicTag,
    text_preview: `Preview of post ${id} about ${topicTag ?? "anything"}`,
    permalink: `https://threads.net/p/${id}`,
    published_at: isoDaysAgo(daysAgo),
  };
}

beforeEach(() => {
  resetMocks();
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("input validation", () => {
  it("rejects empty topic", async () => {
    await expect(checkTopicFreshness("", USER)).rejects.toThrow(/empty/);
  });

  it("rejects whitespace-only topic", async () => {
    await expect(checkTopicFreshness("   ", USER)).rejects.toThrow(/empty/);
  });

  it("rejects topic longer than MAX_TOPIC_LENGTH", async () => {
    const tooLong = "x".repeat(MAX_TOPIC_LENGTH + 1);
    await expect(checkTopicFreshness(tooLong, USER)).rejects.toThrow(/characters/);
  });

  it("rejects non-string topic", async () => {
    await expect(
      checkTopicFreshness(null as unknown as string, USER),
    ).rejects.toThrow(/string/);
  });

  it("rejects missing userId", async () => {
    await expect(checkTopicFreshness("topic", "")).rejects.toThrow(/userId/);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("rate limiting", () => {
  it(`allows the ${MAX_CHECKS_PER_HOUR}th call within an hour`, async () => {
    mockRateLimitCount = MAX_CHECKS_PER_HOUR - 1;
    mockPosts = [];
    const result = await checkTopicFreshness("novel topic", USER);
    expect(result.verdict).toBe("green");
  });

  it(`throws RateLimitError on the ${MAX_CHECKS_PER_HOUR + 1}th call`, async () => {
    mockRateLimitCount = MAX_CHECKS_PER_HOUR;
    await expect(
      checkTopicFreshness("novel topic", USER),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("RateLimitError includes positive retryAfterMs", async () => {
    mockRateLimitCount = MAX_CHECKS_PER_HOUR;
    try {
      await checkTopicFreshness("novel topic", USER);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Sentinel bypass
// ---------------------------------------------------------------------------

describe("sentinel bypass", () => {
  it("skips gate and returns green for 'Surprise me —' topic", async () => {
    // Seed posts that would otherwise match; they must NOT be considered.
    mockPosts = [
      seedPost("p1", "marketing", 1),
      seedPost("p2", "marketing", 2),
      seedPost("p3", "marketing", 3),
    ];
    mockSearchTrends.mockResolvedValue({
      trends: [
        { title: "T", postCount: "1", matchedTopic: "x", relevanceScore: 95 },
      ],
      unavailable: false,
    });

    const result = await checkTopicFreshness(
      `${SURPRISE_ME_SENTINEL} test`,
      USER,
    );
    expect(result.verdict).toBe("green");
    expect(result.externalSignal.unavailable).toBe(true);
    expect(result.externalSignal.reason).toBe("sentinel");
    expect(result.selfRepetitionRisk.severity).toBe("none");
    expect(mockSearchTrends).not.toHaveBeenCalled();
    expect(mockInsertCalls).toHaveLength(1);
    expect(mockInsertCalls[0].verdict).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// Self-repetition severity
// ---------------------------------------------------------------------------

describe("self-repetition severity", () => {
  it("returns high when the matched cluster has ≥2 posts in 7 days", async () => {
    mockPosts = [
      seedPost("p1", "marketing", 1),
      seedPost("p2", "marketing", 3),
      seedPost("p3", "marketing", 6),
    ];
    const result = await checkTopicFreshness("Marketing tips", USER);
    expect(result.selfRepetitionRisk.severity).toBe("high");
    expect(result.selfRepetitionRisk.matchedTag).toBe("marketing");
    expect(result.selfRepetitionRisk.counts.d7).toBe(3);
  });

  it("returns medium when 7d count <2 but 14d count ≥2", async () => {
    mockPosts = [
      seedPost("p1", "marketing", 8),
      seedPost("p2", "marketing", 12),
    ];
    const result = await checkTopicFreshness("Marketing tips", USER);
    expect(result.selfRepetitionRisk.severity).toBe("medium");
    expect(result.selfRepetitionRisk.counts.d7).toBe(0);
    expect(result.selfRepetitionRisk.counts.d14).toBe(2);
  });

  it("returns low when only 30d count ≥2", async () => {
    mockPosts = [
      seedPost("p1", "marketing", 20),
      seedPost("p2", "marketing", 25),
    ];
    const result = await checkTopicFreshness("Marketing tips", USER);
    expect(result.selfRepetitionRisk.severity).toBe("low");
  });

  it("returns none when no cluster matches", async () => {
    mockPosts = [
      seedPost("p1", "cooking", 1),
      seedPost("p2", "travel", 2),
    ];
    const result = await checkTopicFreshness("Quantum physics", USER);
    expect(result.selfRepetitionRisk.severity).toBe("none");
    expect(result.selfRepetitionRisk.matchedTag).toBeNull();
  });

  it("returns none for cold-start users with 0 posts", async () => {
    mockPosts = [];
    const result = await checkTopicFreshness("Marketing tips", USER);
    expect(result.selfRepetitionRisk.severity).toBe("none");
    expect(result.verdict).toBe("green");
  });

  it("ignores posts with null topic_tag", async () => {
    mockPosts = [
      seedPost("p1", null, 1),
      seedPost("p2", null, 2),
      seedPost("p3", null, 3),
    ];
    const result = await checkTopicFreshness("Marketing tips", USER);
    expect(result.selfRepetitionRisk.severity).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// External saturation
// ---------------------------------------------------------------------------

describe("external saturation", () => {
  it("classifies max relevance ≥70 as red", async () => {
    mockSearchTrends.mockResolvedValue({
      trends: [
        { title: "#AI", postCount: "10K", matchedTopic: "ai", relevanceScore: 90 },
      ],
      unavailable: false,
    });
    const result = await checkTopicFreshness("AI agents", USER);
    expect(result.externalSignal.saturation).toBe("red");
    expect(result.externalSignal.topRelevance).toBe(90);
    expect(result.verdict).toBe("red");
    expect(result.sources.some((s) => s.type === "external")).toBe(true);
  });

  it("classifies max relevance in [40,70) as yellow", async () => {
    mockSearchTrends.mockResolvedValue({
      trends: [
        { title: "#X", postCount: "1K", matchedTopic: "x", relevanceScore: 50 },
      ],
      unavailable: false,
    });
    const result = await checkTopicFreshness("some topic", USER);
    expect(result.externalSignal.saturation).toBe("yellow");
    expect(result.verdict).toBe("yellow");
  });

  it("classifies max relevance <40 as green", async () => {
    mockSearchTrends.mockResolvedValue({
      trends: [
        { title: "#X", postCount: "1K", matchedTopic: "x", relevanceScore: 20 },
      ],
      unavailable: false,
    });
    const result = await checkTopicFreshness("some topic", USER);
    expect(result.externalSignal.saturation).toBe("green");
    expect(result.verdict).toBe("green");
  });

  it("treats empty trends as green", async () => {
    mockSearchTrends.mockResolvedValue({ trends: [], unavailable: false });
    const result = await checkTopicFreshness("some topic", USER);
    expect(result.externalSignal.saturation).toBe("green");
    expect(result.externalSignal.trendCount).toBe(0);
    expect(result.externalSignal.unavailable).toBe(false);
  });

  it("marks unavailable when Grok API has no key", async () => {
    mockSearchTrends.mockResolvedValue({ trends: [], unavailable: true });
    const result = await checkTopicFreshness("some topic", USER);
    expect(result.externalSignal.unavailable).toBe(true);
    expect(result.externalSignal.saturation).toBe("green");
    expect(result.externalSignal.topRelevance).toBeNull();
  });

  it("uses max across multiple trends", async () => {
    mockSearchTrends.mockResolvedValue({
      trends: [
        { title: "A", postCount: "1", matchedTopic: "x", relevanceScore: 30 },
        { title: "B", postCount: "1", matchedTopic: "x", relevanceScore: 80 },
        { title: "C", postCount: "1", matchedTopic: "x", relevanceScore: 50 },
      ],
      unavailable: false,
    });
    const result = await checkTopicFreshness("some topic", USER);
    expect(result.externalSignal.topRelevance).toBe(80);
    expect(result.externalSignal.saturation).toBe("red");
  });

  it("uses calibrated thresholds", () => {
    expect(EXTERNAL_SATURATION_RED).toBe(70);
    expect(EXTERNAL_SATURATION_YELLOW).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Combined verdict
// ---------------------------------------------------------------------------

describe("combined verdict", () => {
  it("is red when self=high even if external=green", async () => {
    mockPosts = [
      seedPost("p1", "marketing", 1),
      seedPost("p2", "marketing", 2),
    ];
    const result = await checkTopicFreshness("Marketing tips", USER);
    expect(result.selfRepetitionRisk.severity).toBe("high");
    expect(result.externalSignal.saturation).toBe("green");
    expect(result.verdict).toBe("red");
  });

  it("is yellow when self=low and external=green", async () => {
    mockPosts = [
      seedPost("p1", "marketing", 20),
      seedPost("p2", "marketing", 25),
    ];
    const result = await checkTopicFreshness("Marketing tips", USER);
    expect(result.selfRepetitionRisk.severity).toBe("low");
    expect(result.verdict).toBe("yellow");
  });

  it("escalates to red if external=red even when self=none", async () => {
    mockPosts = [];
    mockSearchTrends.mockResolvedValue({
      trends: [
        { title: "X", postCount: "1", matchedTopic: "x", relevanceScore: 95 },
      ],
      unavailable: false,
    });
    const result = await checkTopicFreshness("some topic", USER);
    expect(result.verdict).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

describe("audit log", () => {
  it("writes a row with the expected shape", async () => {
    mockPosts = [seedPost("p1", "marketing", 1)];
    await checkTopicFreshness("Marketing tips", USER);
    expect(mockInsertCalls).toHaveLength(1);
    const row = mockInsertCalls[0];
    expect(row.user_id).toBe(USER);
    expect(row.topic).toBe("Marketing tips");
    expect(row.verdict).toMatch(/green|yellow|red/);
    expect(row.external_signal).toBeTruthy();
    expect(row.self_repetition_risk).toBeTruthy();
    expect(Array.isArray(row.sources)).toBe(true);
    expect(row.run_id).toBeTruthy();
  });

  it("uses caller-supplied runId when passed", async () => {
    const customRunId = "11111111-1111-1111-1111-111111111111";
    await checkTopicFreshness("novel topic", USER, customRunId);
    expect(mockInsertCalls[0].run_id).toBe(customRunId);
  });

  it("generates a runId when none is supplied", async () => {
    const result = await checkTopicFreshness("novel topic", USER);
    expect(result.runId).toBe(mockUuid);
    expect(mockInsertCalls[0].run_id).toBe(mockUuid);
  });
});
