import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runReviewSweep: vi.fn(),
}));

vi.mock("@/lib/review-sweep", () => ({
  runReviewSweep: mocks.runReviewSweep,
}));

import { POST } from "./route";

describe("POST /api/reviews/sweep auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mocks.runReviewSweep.mockResolvedValue({
      reviewed: 3,
      discarded: 1,
      skipped: 0,
      errors: 0,
      avgLlmMs: 1234,
      durationMs: 5678,
    });
  });

  it("rejects requests without a matching bearer token", async () => {
    const response = await POST(
      new Request("http://localhost/api/reviews/sweep", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.runReviewSweep).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong bearer token", async () => {
    const response = await POST(
      new Request("http://localhost/api/reviews/sweep", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.runReviewSweep).not.toHaveBeenCalled();
  });

  it("runs the sweep and returns its summary when the bearer token matches", async () => {
    const response = await POST(
      new Request("http://localhost/api/reviews/sweep", {
        method: "POST",
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reviewed: 3,
      discarded: 1,
      skipped: 0,
      errors: 0,
      avgLlmMs: 1234,
      durationMs: 5678,
    });
    expect(mocks.runReviewSweep).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the sweep throws", async () => {
    mocks.runReviewSweep.mockRejectedValue(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      new Request("http://localhost/api/reviews/sweep", {
        method: "POST",
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
    consoleError.mockRestore();
  });
});
