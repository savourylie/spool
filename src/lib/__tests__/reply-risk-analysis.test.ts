import { describe, expect, it, vi } from "vitest";

import {
  analyzeReplyRisks,
  parseReplyRiskResponse,
} from "../reply-risk-analysis";

describe("reply risk analysis", () => {
  it("parses valid model output and filters unknown categories", () => {
    const parsed = parseReplyRiskResponse(
      JSON.stringify({
        results: [
          {
            threadsReplyId: "reply-1",
            riskLevel: "high",
            categories: ["professionalism", "not-real"],
            summary: "Could read as hostile in public.",
          },
        ],
      }),
      new Set(["reply-1"]),
    );

    expect(parsed).toEqual([
      {
        threadsReplyId: "reply-1",
        riskLevel: "high",
        riskCategories: ["professionalism"],
        riskSummary: "Could read as hostile in public.",
      },
    ]);
  });

  it("coerces invalid levels to unknown and ignores unknown reply ids", () => {
    const parsed = parseReplyRiskResponse(
      JSON.stringify({
        results: [
          {
            threadsReplyId: "reply-1",
            riskLevel: "severe",
            categories: ["offensive"],
            summary: "Invalid level.",
          },
          {
            threadsReplyId: "reply-2",
            riskLevel: "medium",
            categories: ["privacy"],
            summary: "Not in this batch.",
          },
        ],
      }),
      new Set(["reply-1"]),
    );

    expect(parsed).toEqual([
      {
        threadsReplyId: "reply-1",
        riskLevel: "unknown",
        riskCategories: ["offensive"],
        riskSummary: "Invalid level.",
      },
    ]);
  });

  it("asks the LLM for strict JSON keyed by reply id", async () => {
    const llm = {
      generate: vi.fn().mockResolvedValue(
        JSON.stringify({
          results: [
            {
              threadsReplyId: "reply-1",
              riskLevel: "low",
              categories: [],
              summary: "Looks fine.",
            },
          ],
        }),
      ),
    };

    const results = await analyzeReplyRisks(
      [{ threadsReplyId: "reply-1", text: "Appreciate the thoughtful reply." }],
      llm,
    );

    expect(results[0].riskLevel).toBe("low");
    expect(llm.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: expect.stringContaining("reply-1"),
          }),
        ],
      }),
    );
  });
});
