import { describe, expect, it } from "vitest";
import {
  classifyReplies,
  computeDiscussionQualityScore,
  SHORT_REPLY_THRESHOLD,
  MEDIUM_REPLY_THRESHOLD,
  type ReplyRow,
} from "@/lib/reply-analysis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReply(wordCount: number | null): ReplyRow {
  const words =
    wordCount !== null
      ? Array.from({ length: wordCount }, (_, i) => `word${i}`).join(" ")
      : null;
  return { text: words, word_count: wordCount };
}

// ---------------------------------------------------------------------------
// classifyReplies
// ---------------------------------------------------------------------------

describe("classifyReplies", () => {
  it("returns empty buckets for empty array", () => {
    const result = classifyReplies([]);
    expect(result).toEqual({ short: [], medium: [], long: [] });
  });

  it("classifies all short replies (word_count < 5)", () => {
    const replies = [makeReply(1), makeReply(3), makeReply(4)];
    const result = classifyReplies(replies);
    expect(result.short).toHaveLength(3);
    expect(result.medium).toHaveLength(0);
    expect(result.long).toHaveLength(0);
  });

  it("classifies all medium replies (5 <= word_count < 20)", () => {
    const replies = [makeReply(5), makeReply(10), makeReply(19)];
    const result = classifyReplies(replies);
    expect(result.short).toHaveLength(0);
    expect(result.medium).toHaveLength(3);
    expect(result.long).toHaveLength(0);
  });

  it("classifies all long replies (word_count >= 20)", () => {
    const replies = [makeReply(20), makeReply(50), makeReply(100)];
    const result = classifyReplies(replies);
    expect(result.short).toHaveLength(0);
    expect(result.medium).toHaveLength(0);
    expect(result.long).toHaveLength(3);
  });

  it("classifies mixed replies into correct buckets", () => {
    const replies = [makeReply(2), makeReply(10), makeReply(25)];
    const result = classifyReplies(replies);
    expect(result.short).toHaveLength(1);
    expect(result.medium).toHaveLength(1);
    expect(result.long).toHaveLength(1);
  });

  it("treats null word_count as short", () => {
    const replies = [makeReply(null)];
    const result = classifyReplies(replies);
    expect(result.short).toHaveLength(1);
    expect(result.medium).toHaveLength(0);
    expect(result.long).toHaveLength(0);
  });

  it("boundary: word_count exactly at SHORT_REPLY_THRESHOLD is medium", () => {
    const reply = makeReply(SHORT_REPLY_THRESHOLD);
    const result = classifyReplies([reply]);
    expect(result.medium).toHaveLength(1);
  });

  it("boundary: word_count exactly at MEDIUM_REPLY_THRESHOLD is long", () => {
    const reply = makeReply(MEDIUM_REPLY_THRESHOLD);
    const result = classifyReplies([reply]);
    expect(result.long).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// computeDiscussionQualityScore
// ---------------------------------------------------------------------------

describe("computeDiscussionQualityScore", () => {
  it("returns 0 for empty array", () => {
    expect(computeDiscussionQualityScore([])).toBe(0);
  });

  it("returns 10 for all short replies (weight 1/10 * 100)", () => {
    const replies = [makeReply(1), makeReply(2), makeReply(3)];
    expect(computeDiscussionQualityScore(replies)).toBe(10);
  });

  it("returns 50 for all medium replies (weight 5/10 * 100)", () => {
    const replies = [makeReply(7), makeReply(10), makeReply(15)];
    expect(computeDiscussionQualityScore(replies)).toBe(50);
  });

  it("returns 100 for all long replies (weight 10/10 * 100)", () => {
    const replies = [makeReply(25), makeReply(30), makeReply(50)];
    expect(computeDiscussionQualityScore(replies)).toBe(100);
  });

  it("computes correct weighted average for mixed replies", () => {
    // 1 short (w=1) + 1 medium (w=5) + 1 long (w=10) = 16 / (3*10) * 100 ≈ 53.33
    const replies = [makeReply(2), makeReply(10), makeReply(25)];
    const score = computeDiscussionQualityScore(replies);
    expect(score).toBeCloseTo(53.33, 1);
  });

  it("handles single reply correctly", () => {
    expect(computeDiscussionQualityScore([makeReply(3)])).toBe(10);
    expect(computeDiscussionQualityScore([makeReply(10)])).toBe(50);
    expect(computeDiscussionQualityScore([makeReply(25)])).toBe(100);
  });
});
