import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  buildComposerPrompt: vi.fn(),
  computeNormalizedWES: vi.fn(),
  from: vi.fn(),
  getActiveVoiceProfile: vi.fn(),
  getSession: vi.fn(),
  parseComposerResponse: vi.fn(),
  predictEngagement: vi.fn(),
  resolveLLMClient: vi.fn(),
  rpc: vi.fn(),
  snapshotPrediction: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

vi.mock("@/lib/llm-resolver", () => ({
  resolveLLMClient: mocks.resolveLLMClient,
}));

vi.mock("@/lib/composer-prompt", () => ({
  buildComposerPrompt: mocks.buildComposerPrompt,
  parseComposerResponse: mocks.parseComposerResponse,
}));

vi.mock("@/lib/brand-voice", () => ({
  getActiveVoiceProfile: mocks.getActiveVoiceProfile,
}));

vi.mock("@/lib/weighted-engagement", () => ({
  computeNormalizedWES: mocks.computeNormalizedWES,
}));

vi.mock("@/lib/engagement-prediction", () => ({
  predictEngagement: mocks.predictEngagement,
}));

vi.mock("@/lib/post-review", () => ({
  snapshotPrediction: mocks.snapshotPrediction,
}));

import { POST } from "./route";

describe("POST /api/compose", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSession.mockReturnValue("user-uuid");
    mocks.buildComposerPrompt.mockReturnValue({
      systemPrompt: [{ text: "system" }],
      userMessage: "user",
    });
    mocks.parseComposerResponse.mockReturnValue([
      {
        content: "First generated draft",
        shareTrigger: "voice-of-the-reader",
      },
      {
        content: "Second generated draft",
        shareTrigger: "time-saving-compilation",
      },
    ]);
    mocks.computeNormalizedWES.mockReturnValue(1);
    mocks.getActiveVoiceProfile.mockResolvedValue(null);
    mocks.predictEngagement.mockReturnValue({
      status: "ok",
      range: {
        p25: 100,
        p50: 200,
        p75: 300,
        matchedCount: 12,
        confidence: "medium",
      },
    });
    mocks.snapshotPrediction
      .mockResolvedValueOnce("prediction-1")
      .mockResolvedValueOnce("prediction-2");
    mocks.resolveLLMClient.mockResolvedValue({
      async *generateStreamIterator() {
        yield "[TRIGGER: voice-of-the-reader]\nFirst generated draft\n---\n[TRIGGER: time-saving-compilation]\nSecond generated draft";
      },
    });

    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "post-1",
          text_preview: "Top post preview",
          views: 1000,
          likes: 100,
          replies: 10,
          reposts: 5,
          quotes: 2,
          shares: 3,
          published_at: "2026-04-20T10:00:00Z",
          media_type: "TEXT",
        },
      ],
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "posts") {
        return {
          select: (fields: string) => {
            if (fields === "id, text_full") {
              return {
                eq: () => ({
                  not: () =>
                    Promise.resolve({
                      data: [{ id: "post-1", text_full: "Top post body" }],
                      error: null,
                    }),
                }),
              };
            }

            return {
              eq: () => ({
                not: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({
                        data: [{ topic_tag: "growth" }],
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === "demographics") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }

      if (table === "daily_stats") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [{ followers_count: 1200 }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }

      if (table === "drafts") {
        return {
          insert: () => ({
            select: () =>
              Promise.resolve({
                data: [{ id: "draft-1" }, { id: "draft-2" }],
                error: null,
              }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("snapshots predictions per draft and emits prediction ids in the SSE payload", async () => {
    const request = new NextRequest("http://localhost/api/compose", {
      method: "POST",
      body: JSON.stringify({
        topic: "Growth hooks",
        style: "Professional",
        predictionContext: {
          dayOfWeek: 2,
          hourOfDay: 9,
        },
      }),
    });

    const response = await POST(request);
    const responseText = await response.text();

    expect(mocks.snapshotPrediction).toHaveBeenCalledTimes(2);
    expect(mocks.snapshotPrediction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "user-uuid",
        draftText: "First generated draft",
        driverFactors: expect.objectContaining({
          source: "composer",
          shareTrigger: "voice-of-the-reader",
          predictionContext: {
            dayOfWeek: 2,
            hourOfDay: 9,
          },
        }),
      }),
    );
    expect(responseText).toContain('"predictionId":"prediction-1"');
    expect(responseText).toContain('"predictionId":"prediction-2"');
  });
});
