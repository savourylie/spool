import { describe, it, expect, vi, beforeEach } from "vitest";

import type { BackfillJob } from "@/lib/backfill-job";
import type {
  FreshnessResult,
  FreshnessVerdict,
} from "@/lib/freshness-gate";
import type { TopicSuggestion } from "@/lib/topic-suggestions";

// ── Mock helpers ─────────────────────────────────────────────────────

const mockCheckTopicFreshness = vi.fn();
const mockReframeTopicAngle = vi.fn();
const mockGenerate = vi.fn();

let mockPostRows: { text_full: string | null }[] = [];
let mockPostError: { message: string } | null = null;

function createMockFrom(table: string) {
  if (table === "posts") {
    return {
      select: () => ({
        eq: () => ({
          not: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: mockPostError ? null : mockPostRows,
                  error: mockPostError,
                }),
            }),
          }),
        }),
      }),
    };
  }
  return {};
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

vi.mock("@/lib/freshness-gate", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/freshness-gate")>(
      "@/lib/freshness-gate",
    );
  return {
    ...actual,
    checkTopicFreshness: (...args: unknown[]) => mockCheckTopicFreshness(...args),
  };
});

vi.mock("@/lib/freshness-reframe", () => ({
  reframeTopicAngle: (...args: unknown[]) => mockReframeTopicAngle(...args),
}));

vi.mock("@/lib/llm-resolver", () => ({
  resolveLLMClient: async () => ({
    generate: mockGenerate,
    generateStream: () => {
      throw new Error("not used");
    },
    generateStreamIterator: async function* () {},
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

// Force generateTopicSuggestions to feed a controlled list of topics by
// mocking the LLM's raw JSON output. This keeps parsing paths real while
// letting each test pick the top-3 topics.
function setLLMTopics(topics: TopicSuggestion[]) {
  const payload = topics.map((t) => ({
    name: t.name,
    relevanceScore: t.relevanceScore,
    semanticDistance: t.semanticDistance,
    rationale: t.rationale,
  }));
  mockGenerate.mockResolvedValue(JSON.stringify(payload));
}

function seedPosts(count: number) {
  mockPostRows = Array.from({ length: count }, (_, i) => ({
    text_full: `post body number ${i + 1} about things that happen`,
  }));
}

function freshness(
  verdict: FreshnessVerdict,
  opts: {
    saturation?: "green" | "yellow" | "red";
    d30?: number;
    d14?: number;
    d7?: number;
    severity?: "none" | "low" | "medium" | "high";
  } = {},
): FreshnessResult {
  return {
    runId: "run-1",
    verdict,
    externalSignal: {
      saturation: opts.saturation ?? (verdict === "green" ? "green" : "yellow"),
      topRelevance: null,
      trendCount: 0,
      unavailable: false,
    },
    selfRepetitionRisk: {
      severity: opts.severity ?? "none",
      matchedCluster: null,
      matchedTag: null,
      counts: {
        d7: opts.d7 ?? 0,
        d14: opts.d14 ?? 0,
        d30: opts.d30 ?? 0,
      },
    },
    sources: [],
  };
}

beforeEach(() => {
  mockCheckTopicFreshness.mockReset();
  mockReframeTopicAngle.mockReset();
  mockGenerate.mockReset();
  mockPostRows = [];
  mockPostError = null;
});

// Import after mocks are wired.
import { getTodayHubTopicsBundle } from "../today-hub-freshness";

const USER = "user-hub";

const COMPLETE_JOB: BackfillJob = {
  id: "job-1",
  status: "complete",
  processed_posts: 20,
  total_posts: 20,
  stage: "complete",
  current_post_id: null,
  last_heartbeat_at: null,
  last_error_message: null,
  last_error_status: null,
  last_error_payload: null,
  created_at: new Date().toISOString(),
  started_at: null,
  completed_at: null,
};

const RUNNING_JOB: BackfillJob = { ...COMPLETE_JOB, status: "running" };

const TOPIC_A: TopicSuggestion = {
  name: "AI Agents",
  relevanceScore: 90,
  semanticDistance: "near",
  rationale: "Direct extension of your AI content.",
};
const TOPIC_B: TopicSuggestion = {
  name: "Remote Work",
  relevanceScore: 70,
  semanticDistance: "medium",
  rationale: "Audience overlap with remote workers.",
};
const TOPIC_C: TopicSuggestion = {
  name: "Design Systems",
  relevanceScore: 60,
  semanticDistance: "far",
  rationale: "Adjacent craft overlap.",
};

describe("getTodayHubTopicsBundle", () => {
  it("returns empty bundle when backfill is importing", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    const out = await getTodayHubTopicsBundle(USER, RUNNING_JOB);
    expect(out.filteredTopics).toHaveLength(0);
    expect(out.insufficient).toBe(false);
    expect(mockCheckTopicFreshness).not.toHaveBeenCalled();
  });

  it("returns insufficient when user has fewer than 5 posts", async () => {
    seedPosts(3);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.insufficient).toBe(true);
    expect(out.filteredTopics).toHaveLength(0);
    expect(mockCheckTopicFreshness).not.toHaveBeenCalled();
  });

  it("happy path: 3 green candidates all surface with chips", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    mockCheckTopicFreshness.mockImplementation(() =>
      Promise.resolve(freshness("green")),
    );

    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.allCount).toBe(3);
    expect(out.filteredTopics.map((t) => t.name)).toEqual([
      "AI Agents",
      "Remote Work",
      "Design Systems",
    ]);
    expect(out.freshness["AI Agents"].verdict).toBe("green");
    expect(out.freshness["Remote Work"].verdict).toBe("green");
    expect(out.freshness["Design Systems"].verdict).toBe("green");
    expect(Object.keys(out.reframes)).toHaveLength(0);
    expect(out.rateLimited).toBe(false);
    expect(mockReframeTopicAngle).not.toHaveBeenCalled();
  });

  it("drops red candidates", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    mockCheckTopicFreshness.mockImplementation((topic: string) => {
      if (topic === "Remote Work") return Promise.resolve(freshness("red"));
      return Promise.resolve(freshness("green"));
    });
    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.filteredTopics.map((t) => t.name)).toEqual([
      "AI Agents",
      "Design Systems",
    ]);
    expect(out.freshness["Remote Work"]).toBeUndefined();
  });

  it("surfaces yellow with reframe when external-only + cold self window", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    mockCheckTopicFreshness.mockImplementation((topic: string) => {
      if (topic === "Remote Work") {
        return Promise.resolve(
          freshness("yellow", { saturation: "yellow", d30: 0 }),
        );
      }
      return Promise.resolve(freshness("green"));
    });
    mockReframeTopicAngle.mockResolvedValue("Remote work for parents only");

    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.filteredTopics.map((t) => t.name)).toEqual([
      "AI Agents",
      "Remote Work",
      "Design Systems",
    ]);
    expect(out.freshness["Remote Work"].verdict).toBe("yellow");
    expect(out.reframes["Remote Work"]).toBe("Remote work for parents only");
    expect(mockReframeTopicAngle).toHaveBeenCalledWith("Remote Work", USER);
  });

  it("drops yellow with self-repetition (not external-only)", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    mockCheckTopicFreshness.mockImplementation((topic: string) => {
      if (topic === "Remote Work") {
        return Promise.resolve(
          freshness("yellow", { saturation: "green", severity: "medium", d30: 2 }),
        );
      }
      return Promise.resolve(freshness("green"));
    });

    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.filteredTopics.map((t) => t.name)).toEqual([
      "AI Agents",
      "Design Systems",
    ]);
    expect(out.freshness["Remote Work"]).toBeUndefined();
    expect(mockReframeTopicAngle).not.toHaveBeenCalled();
  });

  it("drops yellow when reframe returns null", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    mockCheckTopicFreshness.mockImplementation((topic: string) => {
      if (topic === "Remote Work") {
        return Promise.resolve(
          freshness("yellow", { saturation: "yellow", d30: 0 }),
        );
      }
      return Promise.resolve(freshness("green"));
    });
    mockReframeTopicAngle.mockResolvedValue(null);

    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.filteredTopics.map((t) => t.name)).toEqual([
      "AI Agents",
      "Design Systems",
    ]);
    expect(out.reframes["Remote Work"]).toBeUndefined();
  });

  it("keeps rate-limited candidates without chips and sets rateLimited flag", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    const { RateLimitError } = await import("@/lib/freshness-gate");
    mockCheckTopicFreshness.mockImplementation((topic: string) => {
      if (topic === "AI Agents") return Promise.reject(new RateLimitError(60_000));
      return Promise.resolve(freshness("green"));
    });

    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.rateLimited).toBe(true);
    expect(out.filteredTopics.map((t) => t.name)).toContain("AI Agents");
    expect(out.freshness["AI Agents"]).toBeUndefined();
    expect(out.freshness["Remote Work"].verdict).toBe("green");
  });

  it("keeps candidate without chip on unexpected gate error", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCheckTopicFreshness.mockImplementation((topic: string) => {
      if (topic === "AI Agents") return Promise.reject(new Error("network"));
      return Promise.resolve(freshness("green"));
    });
    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.rateLimited).toBe(true);
    expect(out.filteredTopics.map((t) => t.name)).toContain("AI Agents");
    expect(out.freshness["AI Agents"]).toBeUndefined();
    warn.mockRestore();
  });

  it("returns allCount=3 with no filteredTopics when all three are red", async () => {
    seedPosts(20);
    setLLMTopics([TOPIC_A, TOPIC_B, TOPIC_C]);
    mockCheckTopicFreshness.mockResolvedValue(freshness("red"));
    const out = await getTodayHubTopicsBundle(USER, COMPLETE_JOB);
    expect(out.allCount).toBe(3);
    expect(out.filteredTopics).toHaveLength(0);
    expect(out.rateLimited).toBe(false);
  });
});
