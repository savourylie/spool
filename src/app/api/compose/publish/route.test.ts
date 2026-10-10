import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  markPredictionPublished: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/post-review", () => ({
  markPredictionPublished: mocks.markPredictionPublished,
}));

import { POST } from "./route";

describe("POST /api/compose/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.markPredictionPublished.mockResolvedValue(undefined);
  });

  it("marks a composer draft as published", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/compose/publish", {
        method: "POST",
        body: JSON.stringify({
          predictionId: "prediction-1",
          draftText: "Final draft text",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      predictionId: "prediction-1",
    });
    expect(mocks.markPredictionPublished).toHaveBeenCalledWith({
      userId: "user-uuid",
      predictionId: "prediction-1",
      draftText: "Final draft text",
    });
  });
});
