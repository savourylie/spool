import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { LLMAuthError } from "@/lib/llm-client";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  syncUserReplies: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/user-replies-sync", () => ({
  syncUserReplies: mocks.syncUserReplies,
}));

import { POST } from "./route";

describe("replies sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.syncUserReplies.mockResolvedValue({
      repliesStored: 2,
      repliesAnalyzed: 10,
      highRisk: 1,
      mediumRisk: 2,
      remainingUnanalyzed: 0,
    });
  });

  it("syncs authored replies for the current user", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/replies/sync", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      repliesStored: 2,
      repliesAnalyzed: 10,
      highRisk: 1,
      mediumRisk: 2,
      remainingUnanalyzed: 0,
    });
    expect(mocks.syncUserReplies).toHaveBeenCalledWith("user-uuid");
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getSession.mockReturnValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/replies/sync", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.syncUserReplies).not.toHaveBeenCalled();
  });

  it("returns 503 when the LLM service is unavailable", async () => {
    mocks.syncUserReplies.mockRejectedValue(new LLMAuthError("missing key"));

    const response = await POST(
      new NextRequest("http://localhost/api/replies/sync", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "LLM service unavailable",
    });
  });

  it("returns 500 when the sync fails", async () => {
    mocks.syncUserReplies.mockRejectedValue(new Error("Threads unavailable"));

    const response = await POST(
      new NextRequest("http://localhost/api/replies/sync", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to sync replies",
    });
  });
});
