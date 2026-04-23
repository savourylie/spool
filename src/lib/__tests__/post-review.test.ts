import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

import {
  POST_PREDICTION_DRAFT_TEXT_LIMIT,
  jaccardTrigramSimilarity,
  linkPredictionToPost,
  markPredictionPublished,
  snapshotPrediction,
} from "../post-review";

function createSnapshotSelectChain(response: { data: unknown; error: unknown }) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          is: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve(response),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

function createInsertChain(
  response: { data: unknown; error: unknown },
  onInsert?: (payload: unknown) => void,
) {
  return {
    insert: (payload: unknown) => {
      onInsert?.(payload);
      return {
        select: () => ({
          single: () => Promise.resolve(response),
        }),
      };
    },
  };
}

function createUpdateChain(
  response: { data: unknown; error: unknown },
  onUpdate?: (payload: unknown) => void,
) {
  return {
    update: (payload: unknown) => {
      onUpdate?.(payload);
      return {
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve(response),
            }),
          }),
        }),
      };
    },
  };
}

function createLinkSelectChain(response: { data: unknown; error: unknown }) {
  return {
    select: () => ({
      eq: () => ({
        is: () => ({
          not: () => ({
            eq: () => ({
              gte: () => ({
                order: () => Promise.resolve(response),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

function createLinkUpdateChain(
  response: { data: unknown; error: unknown },
  onUpdate?: (payload: unknown) => void,
) {
  return {
    update: (payload: unknown) => {
      onUpdate?.(payload);
      return {
        eq: () => ({
          eq: () => ({
            is: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve(response),
                }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

describe("post-review helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an existing snapshot id when the draft hash already exists", async () => {
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("post_predictions");
      return {
        ...createSnapshotSelectChain({
          data: { id: "prediction-existing" },
          error: null,
        }),
        ...createInsertChain({ data: null, error: null }),
      };
    });

    const predictionId = await snapshotPrediction({
      userId: "user-uuid",
      draftText: "A matching draft",
      ranges: {
        p25: 100,
        p50: 200,
        p75: 300,
        matchedCount: 12,
        confidence: "medium",
      },
      driverFactors: { source: "composer" },
    });

    expect(predictionId).toBe("prediction-existing");
  });

  it("inserts a new snapshot when the draft hash is new", async () => {
    let insertedPayload: unknown;

    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("post_predictions");
      return {
        ...createSnapshotSelectChain({
          data: null,
          error: null,
        }),
        ...createInsertChain(
          {
            data: { id: "prediction-new" },
            error: null,
          },
          (payload) => {
            insertedPayload = payload;
          },
        ),
      };
    });

    const predictionId = await snapshotPrediction({
      userId: "user-uuid",
      draftText: "A brand new draft",
      ranges: {
        p25: 110,
        p50: 220,
        p75: 330,
        matchedCount: 18,
        confidence: "high",
      },
      driverFactors: { source: "scanner" },
    });

    expect(predictionId).toBe("prediction-new");
    expect(insertedPayload).toEqual(
      expect.objectContaining({
        user_id: "user-uuid",
        ranges: expect.objectContaining({
          p25: 110,
          p50: 220,
          p75: 330,
        }),
        driver_factors: { source: "scanner" },
      }),
    );
  });

  it("updates the stored draft text and hash when a prediction is marked published", async () => {
    let updatedPayload: unknown;

    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("post_predictions");
      return createUpdateChain(
        {
          data: { id: "prediction-1" },
          error: null,
        },
        (payload) => {
          updatedPayload = payload;
        },
      );
    });

    const longDraftText = "x".repeat(POST_PREDICTION_DRAFT_TEXT_LIMIT + 50);

    await markPredictionPublished({
      userId: "user-uuid",
      predictionId: "prediction-1",
      draftText: longDraftText,
    });

    expect(updatedPayload).toEqual(
      expect.objectContaining({
        draft_text: "x".repeat(POST_PREDICTION_DRAFT_TEXT_LIMIT),
        draft_text_hash: expect.any(String),
      }),
    );
  });

  it("links the highest-similarity candidate above the threshold", async () => {
    let updatedPayload: unknown;

    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("post_predictions");
      return {
        ...createLinkSelectChain({
          data: [
            {
              id: "prediction-low",
              draft_text: "Completely unrelated post",
            },
            {
              id: "prediction-best",
              draft_text: "This is the exact draft text to match",
            },
          ],
          error: null,
        }),
        ...createLinkUpdateChain(
          {
            data: { id: "prediction-best" },
            error: null,
          },
          (payload) => {
            updatedPayload = payload;
          },
        ),
      };
    });

    const result = await linkPredictionToPost({
      userId: "user-uuid",
      postId: "post-uuid-1",
      postText: "This is the exact draft text to match",
    });

    expect(result).toEqual({
      predictionId: "prediction-best",
      similarity: 1,
    });
    expect(updatedPayload).toEqual({ post_id: "post-uuid-1" });
  });

  it("returns null when no candidate reaches the similarity threshold", async () => {
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("post_predictions");
      return {
        ...createLinkSelectChain({
          data: [
            {
              id: "prediction-low",
              draft_text: "A distant and unrelated thought",
            },
          ],
          error: null,
        }),
        ...createLinkUpdateChain({ data: null, error: null }),
      };
    });

    const result = await linkPredictionToPost({
      userId: "user-uuid",
      postId: "post-uuid-1",
      postText: "This post should not match",
    });

    expect(result).toBeNull();
  });

  it("computes trigram similarity for identical and unrelated texts", () => {
    expect(
      jaccardTrigramSimilarity("Matching text", "Matching text"),
    ).toBe(1);
    expect(
      jaccardTrigramSimilarity("Matching text", "Completely different"),
    ).toBeLessThan(0.7);
  });
});
