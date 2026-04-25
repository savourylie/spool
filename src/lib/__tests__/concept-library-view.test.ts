import { describe, expect, it } from "vitest";

import {
  buildConceptAdvisoryPayload,
  buildConceptLibraryRows,
  tokenizeConceptText,
  type ConceptLedgerEntry,
  type ConceptLedgerPost,
} from "../concept-library-view";

const NOW = new Date("2026-04-25T12:00:00Z");

function entry(
  concept: string,
  postId: string,
  seenAt: string,
  analogy: string | null = null,
): ConceptLedgerEntry {
  return {
    concept,
    post_id: postId,
    seen_at: seenAt,
    analogy,
  };
}

function post(
  id: string,
  topicTag: string | null = null,
): ConceptLedgerPost {
  return {
    id,
    text_preview: `Preview ${id}`,
    text_full: `Full text ${id}`,
    permalink: `https://threads.net/${id}`,
    published_at: "2026-01-01T00:00:00Z",
    topic_tag: topicTag,
  };
}

describe("tokenizeConceptText", () => {
  it("normalizes punctuation, stop words, and duplicate terms", () => {
    expect(tokenizeConceptText("How cognitive-load, cognitive load works")).toEqual([
      "cognitive",
      "load",
      "works",
    ]);
  });
});

describe("buildConceptLibraryRows", () => {
  it("aggregates counts, analogies, first seen, last used, and reuse risk", () => {
    const rows = buildConceptLibraryRows(
      [
        entry(
          "Cognitive Load",
          "p1",
          "2026-02-01T00:00:00Z",
          "factory assembly line",
        ),
        entry(
          "cognitive load",
          "p2",
          "2026-03-01T00:00:00Z",
          "rainforest ecosystem",
        ),
        entry(
          "cognitive load",
          "p3",
          "2026-04-01T00:00:00Z",
          "rainforest ecosystem",
        ),
      ],
      [post("p1", "productivity"), post("p2", "productivity"), post("p3")],
      NOW,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      concept: "cognitive load",
      timesExplained: 3,
      recentUseCount: 3,
      reuseRisk: "red",
      lastUsedAt: "2026-04-01T00:00:00Z",
      relatedCluster: "productivity",
      firstSeenPost: {
        id: "p1",
        textPreview: "Preview p1",
        permalink: "https://threads.net/p1",
        seenAt: "2026-02-01T00:00:00Z",
      },
    });
    expect(rows[0].analogies).toEqual([
      { analogy: "rainforest ecosystem", count: 2 },
      { analogy: "factory assembly line", count: 1 },
    ]);
  });

  it("computes reuse risk from the 90-day window only", () => {
    const rows = buildConceptLibraryRows(
      [
        entry("old idea", "p1", "2025-01-01T00:00:00Z"),
        entry("old idea", "p2", "2025-02-01T00:00:00Z"),
        entry("old idea", "p3", "2026-04-01T00:00:00Z"),
      ],
      [post("p1"), post("p2"), post("p3")],
      NOW,
    );

    expect(rows[0].timesExplained).toBe(3);
    expect(rows[0].recentUseCount).toBe(1);
    expect(rows[0].reuseRisk).toBe("green");
  });
});

describe("buildConceptAdvisoryPayload", () => {
  it("returns top recent concept matches for a topic", () => {
    const rows = buildConceptLibraryRows(
      [
        entry("cognitive load", "p1", "2026-02-01T00:00:00Z", "factory"),
        entry("cognitive load", "p2", "2026-03-01T00:00:00Z", "factory"),
        entry("cognitive load", "p3", "2026-04-01T00:00:00Z", "rainforest"),
        entry("habit loops", "p4", "2026-04-01T00:00:00Z"),
      ],
      [post("p1"), post("p2"), post("p3"), post("p4")],
      NOW,
    );

    const advisory = buildConceptAdvisoryPayload(
      rows,
      "Reducing cognitive load in onboarding",
    );

    expect(advisory?.matches).toHaveLength(1);
    expect(advisory?.matches[0]).toMatchObject({
      concept: "cognitive load",
      usesInWindow: 3,
      totalUses: 3,
      reuseRisk: "red",
    });
    expect(advisory?.matches[0].analogies).toEqual([
      { analogy: "factory", count: 2 },
      { analogy: "rainforest", count: 1 },
    ]);
  });

  it("falls back to related clusters only when concept text does not match", () => {
    const rows = buildConceptLibraryRows(
      [entry("switching costs", "p1", "2026-04-01T00:00:00Z")],
      [post("p1", "creator monetization")],
      NOW,
    );

    const advisory = buildConceptAdvisoryPayload(
      rows,
      "Creator monetization ideas",
    );

    expect(advisory?.matches[0].concept).toBe("switching costs");
  });

  it("does not warn for concepts used only outside the reuse window", () => {
    const rows = buildConceptLibraryRows(
      [entry("cognitive load", "p1", "2025-01-01T00:00:00Z")],
      [post("p1")],
      NOW,
    );

    expect(
      buildConceptAdvisoryPayload(rows, "cognitive load"),
    ).toBeNull();
  });
});
