import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshDailyStats, refreshAllDailyStats } from "../daily-stats";

// --- Mock tracking ---

const calls: {
  table: string;
  op: string;
  args: unknown[];
}[] = [];

function trackCall(table: string, op: string, ...args: unknown[]) {
  calls.push({ table, op, args });
}

// --- Configurable mock state ---

let mockUserResult: { data: unknown; error: unknown } = {
  data: {
    threads_user_id: "threads-123",
    access_token: "encrypted",
    token_expires_at: new Date(Date.now() + 86400000).toISOString(),
  },
  error: null,
};

let mockUsersListResult: { data: unknown; error: unknown } = {
  data: [{ id: "user-uuid" }],
  error: null,
};

// --- Supabase mock ---

function createMockFrom(table: string) {
  if (table === "users") {
    return {
      select: (fields: string) => {
        if (fields === "id") {
          return Promise.resolve(mockUsersListResult);
        }
        return {
          eq: () => ({
            single: () => Promise.resolve(mockUserResult),
          }),
        };
      },
    };
  }

  if (table === "daily_stats") {
    return {
      upsert: (...args: unknown[]) => {
        trackCall(table, "upsert", ...args);
        return Promise.resolve({ error: null });
      },
    };
  }

  if (table === "demographics") {
    return {
      upsert: (...args: unknown[]) => {
        trackCall(table, "upsert", ...args);
        return Promise.resolve({ error: null });
      },
    };
  }

  if (table === "demographics_history") {
    return {
      insert: (...args: unknown[]) => {
        trackCall(table, "insert", ...args);
        return Promise.resolve({ error: null });
      },
    };
  }

  return {
    insert: () => Promise.resolve({ error: null }),
    upsert: () => Promise.resolve({ error: null }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

// --- ThreadsAPI mock ---

const mockGetFollowersCount = vi.fn();
const mockGetFollowerDemographics = vi.fn();

vi.mock("@/lib/threads-api", () => ({
  ThreadsAPI: vi.fn().mockImplementation(function () {
    return {
      getFollowersCount: mockGetFollowersCount,
      getFollowerDemographics: mockGetFollowerDemographics,
    };
  }),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-token"),
}));

// --- Helpers ---

function getDailyStatsUpserts() {
  return calls
    .filter((c) => c.table === "daily_stats" && c.op === "upsert")
    .map((c) => c.args[0]);
}

function getDemographicsUpserts() {
  return calls
    .filter((c) => c.table === "demographics" && c.op === "upsert")
    .map((c) => c.args[0]);
}

function getDemographicsHistoryInserts() {
  return calls
    .filter((c) => c.table === "demographics_history" && c.op === "insert")
    .map((c) => c.args[0]);
}

// --- Tests ---

describe("refreshDailyStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;

    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    };

    mockUsersListResult = {
      data: [{ id: "user-uuid" }],
      error: null,
    };

    mockGetFollowersCount.mockResolvedValue(500);

    mockGetFollowerDemographics.mockImplementation((dimension: string) =>
      Promise.resolve({
        dimension,
        values: [
          { key: "US", value: 100 },
          { key: "UK", value: 50 },
        ],
      }),
    );
  });

  it("upserts daily_stats with today's date and follower count", async () => {
    const result = await refreshDailyStats("user-uuid");

    expect(result.followersCount).toBe(500);

    const upserts = getDailyStatsUpserts();
    expect(upserts).toHaveLength(1);

    const today = new Date().toISOString().split("T")[0];
    expect(upserts[0]).toEqual(
      expect.objectContaining({
        user_id: "user-uuid",
        date: today,
        followers_count: 500,
      }),
    );
  });

  it("fetches demographics for all 3 dimensions when followers >= 100", async () => {
    const result = await refreshDailyStats("user-uuid");

    expect(result.demographicsUpdated).toBe(true);
    expect(mockGetFollowerDemographics).toHaveBeenCalledTimes(3);
    expect(mockGetFollowerDemographics).toHaveBeenCalledWith("country");
    expect(mockGetFollowerDemographics).toHaveBeenCalledWith("city");
    expect(mockGetFollowerDemographics).toHaveBeenCalledWith("gender");

    const demoUpserts = getDemographicsUpserts();
    // 3 dimensions × 2 values each = 6 upserts
    expect(demoUpserts).toHaveLength(6);
  });

  it("skips demographics when followers < 100", async () => {
    mockGetFollowersCount.mockResolvedValue(50);

    const result = await refreshDailyStats("user-uuid");

    expect(result.followersCount).toBe(50);
    expect(result.demographicsUpdated).toBe(false);
    expect(mockGetFollowerDemographics).not.toHaveBeenCalled();

    // daily_stats should still be upserted
    const upserts = getDailyStatsUpserts();
    expect(upserts).toHaveLength(1);
  });

  it("skips users with expired tokens", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() - 86400000).toISOString(),
      },
      error: null,
    };

    const result = await refreshDailyStats("user-uuid");

    expect(result).toEqual({ followersCount: 0, demographicsUpdated: false });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("token expired"),
    );
    expect(mockGetFollowersCount).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("handles duplicate runs gracefully via upsert", async () => {
    await refreshDailyStats("user-uuid");
    calls.length = 0;
    await refreshDailyStats("user-uuid");

    // Second run also upserts without error
    const upserts = getDailyStatsUpserts();
    expect(upserts).toHaveLength(1);
  });

  it("inserts into demographics_history alongside demographics upsert", async () => {
    await refreshDailyStats("user-uuid");

    const historyInserts = getDemographicsHistoryInserts();
    // 3 dimensions × 2 values each = 6 inserts
    expect(historyInserts).toHaveLength(6);

    expect(historyInserts[0]).toEqual(
      expect.objectContaining({
        user_id: "user-uuid",
        dimension: expect.any(String),
        key: expect.any(String),
        value: expect.any(Number),
      }),
    );
  });

  it("skips demographics_history when followers < 100", async () => {
    mockGetFollowersCount.mockResolvedValue(50);

    await refreshDailyStats("user-uuid");

    const historyInserts = getDemographicsHistoryInserts();
    expect(historyInserts).toHaveLength(0);
  });

  it("demographics failure is non-fatal", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockGetFollowerDemographics
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce({
        dimension: "city",
        values: [{ key: "NYC", value: 30 }],
      })
      .mockResolvedValueOnce({
        dimension: "gender",
        values: [{ key: "male", value: 60 }],
      });

    const result = await refreshDailyStats("user-uuid");

    // Should still succeed overall
    expect(result.followersCount).toBe(500);
    expect(result.demographicsUpdated).toBe(true);

    // daily_stats still upserted
    expect(getDailyStatsUpserts()).toHaveLength(1);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch country demographics"),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});

describe("refreshAllDailyStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;

    mockUserResult = {
      data: {
        threads_user_id: "threads-123",
        access_token: "encrypted",
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    };

    mockUsersListResult = {
      data: [{ id: "user-uuid" }],
      error: null,
    };

    mockGetFollowersCount.mockResolvedValue(500);

    mockGetFollowerDemographics.mockImplementation((dimension: string) =>
      Promise.resolve({
        dimension,
        values: [{ key: "US", value: 100 }],
      }),
    );
  });

  it("continues to next user on individual failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockUsersListResult = {
      data: [{ id: "user-1" }, { id: "user-2" }],
      error: null,
    };

    mockGetFollowersCount
      .mockRejectedValueOnce(new Error("Rate limited"))
      .mockResolvedValueOnce(200);

    const result = await refreshAllDailyStats();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to refresh daily stats"),
      expect.any(Error),
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
