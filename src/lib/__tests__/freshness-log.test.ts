import { describe, it, expect, vi, beforeEach } from "vitest";

interface VerdictRow {
  verdict: string;
}

let mockRows: VerdictRow[] = [];
let mockError: { message: string } | null = null;
let capturedGteSince: string | null = null;
let capturedUserId: string | null = null;

function createMockFrom(table: string) {
  if (table !== "freshness_checks") {
    return {};
  }
  return {
    select: () => ({
      eq: (_col: string, userId: string) => {
        capturedUserId = userId;
        return {
          gte: (_col2: string, since: string) => {
            capturedGteSince = since;
            return Promise.resolve({
              data: mockError ? null : mockRows,
              error: mockError,
            });
          },
        };
      },
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

import {
  getFreshnessLogCounts,
  FRESHNESS_LOG_WINDOW_DAYS,
} from "../freshness-log";

const USER = "user-log";

beforeEach(() => {
  mockRows = [];
  mockError = null;
  capturedGteSince = null;
  capturedUserId = null;
});

describe("getFreshnessLogCounts", () => {
  it("returns hasData:false on an empty table", async () => {
    mockRows = [];
    const out = await getFreshnessLogCounts(USER);
    expect(out).toEqual({
      green: 0,
      yellow: 0,
      red: 0,
      total: 0,
      hasData: false,
    });
  });

  it("counts mixed verdicts correctly", async () => {
    mockRows = [
      ...Array.from({ length: 10 }, () => ({ verdict: "green" })),
      ...Array.from({ length: 4 }, () => ({ verdict: "yellow" })),
      ...Array.from({ length: 2 }, () => ({ verdict: "red" })),
    ];
    const out = await getFreshnessLogCounts(USER);
    expect(out).toEqual({
      green: 10,
      yellow: 4,
      red: 2,
      total: 16,
      hasData: true,
    });
  });

  it("ignores unexpected verdict values", async () => {
    mockRows = [
      { verdict: "green" },
      { verdict: "unknown" },
      { verdict: "red" },
    ];
    const out = await getFreshnessLogCounts(USER);
    expect(out).toEqual({
      green: 1,
      yellow: 0,
      red: 1,
      total: 2,
      hasData: true,
    });
  });

  it("returns zeroed counts on DB error", async () => {
    mockError = { message: "boom" };
    const out = await getFreshnessLogCounts(USER);
    expect(out.hasData).toBe(false);
    expect(out.total).toBe(0);
  });

  it("uses a 7-day window and filters by userId", async () => {
    const now = new Date("2026-04-23T12:00:00Z");
    mockRows = [{ verdict: "green" }];
    await getFreshnessLogCounts(USER, now);
    expect(capturedUserId).toBe(USER);
    expect(capturedGteSince).not.toBeNull();
    const sinceMs = new Date(capturedGteSince!).getTime();
    const expectedMs = now.getTime() - FRESHNESS_LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    expect(sinceMs).toBe(expectedMs);
  });

  it("returns EMPTY when userId is falsy", async () => {
    const out = await getFreshnessLogCounts("");
    expect(out).toEqual({
      green: 0,
      yellow: 0,
      red: 0,
      total: 0,
      hasData: false,
    });
    expect(capturedUserId).toBeNull();
  });
});
