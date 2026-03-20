import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const scheduledCallbacks: Array<() => void | Promise<void>> = [];

  return {
    scheduledCallbacks,
    after: vi.fn((callback: () => void | Promise<void>) => {
      scheduledCallbacks.push(callback);
    }),
    exchangeCodeForShortLivedToken: vi.fn(),
    exchangeForLongLivedToken: vi.fn(),
    fetchUserProfile: vi.fn(),
    setSessionCookie: vi.fn(),
    encrypt: vi.fn(),
    runBackfill: vi.fn(),
    from: vi.fn(),
  };
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );

  return {
    ...actual,
    after: mocks.after,
  };
});

vi.mock("@/lib/threads", () => ({
  exchangeCodeForShortLivedToken: mocks.exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken: mocks.exchangeForLongLivedToken,
  fetchUserProfile: mocks.fetchUserProfile,
}));

vi.mock("@/lib/session", () => ({
  OAUTH_STATE_COOKIE_NAME: "spool_oauth_state",
  setSessionCookie: mocks.setSessionCookie,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: mocks.from,
  }),
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: mocks.encrypt,
}));

vi.mock("@/lib/backfill", () => ({
  runBackfill: mocks.runBackfill,
}));

import { GET } from "./route";

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scheduledCallbacks.length = 0;

    process.env.THREADS_REDIRECT_URI = "http://localhost/api/auth/callback";

    mocks.exchangeCodeForShortLivedToken.mockResolvedValue({
      access_token: "short-lived-token",
      user_id: "threads-user-id",
    });
    mocks.exchangeForLongLivedToken.mockResolvedValue({
      access_token: "long-lived-token",
      expires_in: 3600,
    });
    mocks.fetchUserProfile.mockResolvedValue({
      id: "threads-user-id",
      username: "spool-user",
    });
    mocks.encrypt.mockReturnValue("encrypted-token");
    mocks.runBackfill.mockResolvedValue(undefined);

    mocks.from.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          upsert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "user-uuid" }, error: null }),
            }),
          }),
        };
      }

      if (table === "backfill_jobs") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "job-uuid" }, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("creates a backfill job and schedules a single background run before redirecting", async () => {
    const request = new NextRequest(
      "http://localhost/api/auth/callback?state=valid-state&code=test-code",
      {
        headers: {
          cookie: "spool_oauth_state=valid-state",
        },
      },
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/loading");
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.runBackfill).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      "user-uuid",
    );

    expect(mocks.scheduledCallbacks).toHaveLength(1);
    await mocks.scheduledCallbacks[0]();

    expect(mocks.runBackfill).toHaveBeenCalledTimes(1);
    expect(mocks.runBackfill).toHaveBeenCalledWith("user-uuid", "job-uuid");
  });
});
