import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshAllUsers: vi.fn(),
  refreshAllDailyStats: vi.fn(),
  refreshAllTokens: vi.fn(),
  refreshAllUsersVelocity: vi.fn(),
}));

vi.mock("@/lib/metrics-refresh", () => ({
  refreshAllUsers: mocks.refreshAllUsers,
}));

vi.mock("@/lib/daily-stats", () => ({
  refreshAllDailyStats: mocks.refreshAllDailyStats,
}));

vi.mock("@/lib/token-refresh", () => ({
  refreshAllTokens: mocks.refreshAllTokens,
}));

vi.mock("@/lib/velocity-check", () => ({
  refreshAllUsersVelocity: mocks.refreshAllUsersVelocity,
}));

import { GET as getDaily } from "./daily/route";
import { GET as getMetrics } from "./metrics/route";
import { GET as getTokenRefresh } from "./token-refresh/route";
import { GET as getVelocity } from "./velocity/route";

describe("cron route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    mocks.refreshAllUsers.mockResolvedValue({ refreshedUsers: 2 });
    mocks.refreshAllDailyStats.mockResolvedValue({ refreshedUsers: 1 });
    mocks.refreshAllTokens.mockResolvedValue({ refreshedUsers: 3 });
    mocks.refreshAllUsersVelocity.mockResolvedValue({ processed: 2, errors: 0 });
  });

  it("rejects requests without a matching bearer token", async () => {
    const response = await getMetrics(
      new Request("http://localhost/api/cron/metrics"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.refreshAllUsers).not.toHaveBeenCalled();
  });

  it("runs the metrics refresh route when the bearer token matches", async () => {
    const response = await getMetrics(
      new Request("http://localhost/api/cron/metrics", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ refreshedUsers: 2 });
    expect(mocks.refreshAllUsers).toHaveBeenCalledTimes(1);
  });

  it("runs the daily stats refresh route when the bearer token matches", async () => {
    const response = await getDaily(
      new Request("http://localhost/api/cron/daily", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ refreshedUsers: 1 });
    expect(mocks.refreshAllDailyStats).toHaveBeenCalledTimes(1);
  });

  it("runs the token refresh route when the bearer token matches", async () => {
    const response = await getTokenRefresh(
      new Request("http://localhost/api/cron/token-refresh", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ refreshedUsers: 3 });
    expect(mocks.refreshAllTokens).toHaveBeenCalledTimes(1);
  });

  it("rejects velocity route requests without a matching bearer token", async () => {
    const response = await getVelocity(
      new Request("http://localhost/api/cron/velocity"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.refreshAllUsersVelocity).not.toHaveBeenCalled();
  });

  it("runs the velocity refresh route when the bearer token matches", async () => {
    const response = await getVelocity(
      new Request("http://localhost/api/cron/velocity", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 2, errors: 0 });
    expect(mocks.refreshAllUsersVelocity).toHaveBeenCalledTimes(1);
  });
});
