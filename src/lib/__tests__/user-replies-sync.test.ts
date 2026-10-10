import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ table: string; op: string; args: unknown[] }> = [];

const mocks = vi.hoisted(() => ({
  getUserReplies: vi.fn(),
  resolveLLMClient: vi.fn(),
  analyzeReplyRisks: vi.fn(),
}));

let mockUserResult: { data: unknown; error: unknown };
let mockLatestReplyResult: { data: unknown; error: unknown };
let mockUnlabeledReplies: Array<{
  threads_reply_id: string;
  text: string;
  replied_at: string;
  permalink: string | null;
}>;

function track(table: string, op: string, ...args: unknown[]) {
  calls.push({ table, op, args });
}

function createMockFrom(table: string) {
  if (table === "users") {
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(mockUserResult),
        }),
      }),
    };
  }

  if (table === "user_replies") {
    const createUnlabeledQuery = (options?: { count?: "exact" }) => {
      const query = {
        eq: () => query,
        not: () => query,
        order: () => query,
        limit: (limit: number) => {
          if (options?.count === "exact") {
            return Promise.resolve({
              data: mockUnlabeledReplies.slice(0, limit),
              count: mockUnlabeledReplies.length,
              error: null,
            });
          }

          return {
            maybeSingle: () => Promise.resolve(mockLatestReplyResult),
          };
        },
      };

      return query;
    };

    return {
      select: (_fields: string, options?: { count?: "exact" }) =>
        createUnlabeledQuery(options),
      upsert: (...args: unknown[]) => {
        track(table, "upsert", ...args);
        return Promise.resolve({ error: null });
      },
      update: (...args: unknown[]) => {
        track(table, "update", ...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            track(table, "eq", ...eqArgs);
            return {
              eq: (...secondEqArgs: unknown[]) => {
                track(table, "eq", ...secondEqArgs);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
  }

  throw new Error(`Unexpected table ${table}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
}));

vi.mock("@/lib/threads-api", () => ({
  ThreadsAPI: vi.fn().mockImplementation(function () {
    return {
      getUserReplies: mocks.getUserReplies,
    };
  }),
}));

vi.mock("@/lib/llm-resolver", () => ({
  resolveLLMClient: mocks.resolveLLMClient,
}));

vi.mock("@/lib/reply-risk-analysis", () => ({
  analyzeReplyRisks: mocks.analyzeReplyRisks,
}));

import { syncUserReplies } from "../user-replies-sync";

describe("syncUserReplies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;

    mockUserResult = {
      data: {
        threads_user_id: "threads-user-1",
        access_token: "encrypted-token",
        token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
      error: null,
    };
    mockLatestReplyResult = {
      data: { replied_at: "2024-12-01T00:00:00Z" },
      error: null,
    };
    mockUnlabeledReplies = Array.from({ length: 101 }, (_, index) => ({
      threads_reply_id: `stored-reply-${index + 1}`,
      text: `Stored reply ${index + 1}`,
      replied_at: "2025-01-01T00:00:00Z",
      permalink: null,
    }));

    mocks.getUserReplies.mockResolvedValue([
      {
        id: "reply-1",
        text: "Fresh reply",
        timestamp: "2025-01-02T00:00:00Z",
        permalink: "https://threads.net/@user/reply1",
        shortcode: "r1",
        media_type: "TEXT_POST",
        root_post: { id: "root-1" },
        replied_to: { id: "parent-1" },
      },
      {
        id: "reply-2",
        text: "Another fresh reply",
        timestamp: "2025-01-03T00:00:00Z",
        permalink: null,
        shortcode: "r2",
        media_type: "TEXT_POST",
        root_post: { id: "root-2" },
        replied_to: { id: "parent-2" },
      },
    ]);
    mocks.resolveLLMClient.mockResolvedValue({ generate: vi.fn() });
    mocks.analyzeReplyRisks.mockImplementation((batch) =>
      Promise.resolve(
        batch.map((reply: { threadsReplyId: string }) => ({
          threadsReplyId: reply.threadsReplyId,
          riskLevel: "low",
          riskCategories: [],
          riskSummary: "Looks fine.",
        })),
      ),
    );
  });

  it("stores fetched authored replies and analyzes at most 100 unlabeled replies", async () => {
    const result = await syncUserReplies("user-uuid");

    expect(mocks.getUserReplies).toHaveBeenCalledWith(new Date("2024-12-01T00:00:00Z"));
    const upserts = calls.filter((call) => call.op === "upsert");
    expect(upserts).toHaveLength(1);
    expect(upserts[0].args[0]).toEqual([
      expect.objectContaining({
        user_id: "user-uuid",
        threads_reply_id: "reply-1",
        root_post_id: "root-1",
        replied_to_id: "parent-1",
      }),
      expect.objectContaining({
        user_id: "user-uuid",
        threads_reply_id: "reply-2",
        root_post_id: "root-2",
        replied_to_id: "parent-2",
      }),
    ]);
    expect(upserts[0].args[1]).toEqual({ onConflict: "threads_reply_id" });
    expect(mocks.analyzeReplyRisks).toHaveBeenCalledTimes(5);
    expect(
      mocks.analyzeReplyRisks.mock.calls.flatMap(([batch]) => batch),
    ).toHaveLength(100);
    expect(result).toEqual({
      repliesStored: 2,
      repliesAnalyzed: 100,
      highRisk: 0,
      mediumRisk: 0,
      remainingUnanalyzed: 1,
    });
  });

  it("writes a large first sync in bounded upsert batches", async () => {
    mocks.getUserReplies.mockResolvedValue(
      Array.from({ length: 1201 }, (_, index) => ({
        id: `reply-${index + 1}`,
        text: `Reply ${index + 1}`,
        timestamp: "2025-01-02T00:00:00Z",
        permalink: null,
        shortcode: `r${index + 1}`,
        media_type: "TEXT_POST",
        root_post: { id: "root-1" },
        replied_to: { id: "parent-1" },
      })),
    );

    const result = await syncUserReplies("user-uuid");

    const batchSizes = calls
      .filter((call) => call.op === "upsert")
      .map((call) => (call.args[0] as unknown[]).length);
    expect(batchSizes).toEqual([500, 500, 201]);
    expect(result.repliesStored).toBe(1201);
  });

  it("writes a reply returned twice by Threads only once", async () => {
    const reply = {
      id: "reply-1",
      text: "Fresh reply",
      timestamp: "2025-01-02T00:00:00Z",
      permalink: null,
      shortcode: "r1",
      media_type: "TEXT_POST",
      root_post: { id: "root-1" },
      replied_to: { id: "parent-1" },
    };
    mocks.getUserReplies.mockResolvedValue([reply, { ...reply }]);

    const result = await syncUserReplies("user-uuid");

    const writtenIds = calls
      .filter((call) => call.op === "upsert")
      .flatMap((call) =>
        (call.args[0] as Array<{ threads_reply_id: string }>).map(
          (row) => row.threads_reply_id,
        ),
      );
    expect(writtenIds).toEqual(["reply-1"]);
    expect(result.repliesStored).toBe(1);
  });

  it("skips Threads and LLM calls when the token is expired", async () => {
    mockUserResult = {
      data: {
        threads_user_id: "threads-user-1",
        access_token: "encrypted-token",
        token_expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
      error: null,
    };

    const result = await syncUserReplies("user-uuid");

    expect(result).toEqual({
      repliesStored: 0,
      repliesAnalyzed: 0,
      highRisk: 0,
      mediumRisk: 0,
      remainingUnanalyzed: 0,
    });
    expect(mocks.getUserReplies).not.toHaveBeenCalled();
    expect(mocks.analyzeReplyRisks).not.toHaveBeenCalled();
  });
});
