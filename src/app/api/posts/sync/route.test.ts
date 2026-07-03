import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshMetrics: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/metrics-refresh", () => ({
  refreshMetrics: mocks.refreshMetrics,
}));

import { POST } from "./route";

describe("posts sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.refreshMetrics.mockResolvedValue({
      newPosts: 2,
      updatedMetrics: 4,
      repliesStored: 6,
    });
  });

  it("refreshes metrics for the current session user", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/posts/sync", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      newPosts: 2,
      updatedMetrics: 4,
      repliesStored: 6,
    });
    expect(mocks.refreshMetrics).toHaveBeenCalledWith("user-uuid");
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getSession.mockReturnValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/posts/sync", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.refreshMetrics).not.toHaveBeenCalled();
  });

  it("returns 500 when the refresh fails", async () => {
    mocks.refreshMetrics.mockRejectedValue(new Error("Threads unavailable"));

    const response = await POST(
      new NextRequest("http://localhost/api/posts/sync", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to sync posts",
    });
  });
});
