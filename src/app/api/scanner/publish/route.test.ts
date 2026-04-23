import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  markPredictionPublished: vi.fn(),
  snapshotPrediction: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/post-review", () => ({
  markPredictionPublished: mocks.markPredictionPublished,
  snapshotPrediction: mocks.snapshotPrediction,
}));

import { POST } from "./route";

describe("POST /api/scanner/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue("user-uuid");
    mocks.snapshotPrediction.mockResolvedValue("prediction-1");
    mocks.markPredictionPublished.mockResolvedValue(undefined);
  });

  it("snapshots and marks scanner text as published", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/scanner/publish", {
        method: "POST",
        body: JSON.stringify({
          text: "A scanner draft worth publishing",
          range: {
            p25: 100,
            p50: 200,
            p75: 300,
            matchedCount: 14,
            confidence: "medium",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      predictionId: "prediction-1",
    });
    expect(mocks.snapshotPrediction).toHaveBeenCalledWith({
      userId: "user-uuid",
      draftText: "A scanner draft worth publishing",
      ranges: {
        p25: 100,
        p50: 200,
        p75: 300,
        matchedCount: 14,
        confidence: "medium",
      },
      driverFactors: {
        source: "scanner",
      },
    });
    expect(mocks.markPredictionPublished).toHaveBeenCalledWith({
      userId: "user-uuid",
      predictionId: "prediction-1",
      draftText: "A scanner draft worth publishing",
    });
  });
});
