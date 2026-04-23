import { describe, expect, it } from "vitest";
import {
  buildScannerPrompt,
  parseAndValidateResponse,
  type UserContext,
} from "../quality-llm";
import { flattenSystemBlocks } from "../llm-client";

// ── Fixtures ──────────────────────────────────────────────────────────

const EMPTY_CONTEXT: UserContext = {
  recentPosts: [],
  topicTags: [],
};

const FULL_CONTEXT: UserContext = {
  recentPosts: [
    { text: "AI is changing everything in tech.", publishedAt: "2026-03-20T10:00:00Z" },
    { text: "Hot take: most productivity advice is recycled.", publishedAt: "2026-03-18T08:00:00Z" },
  ],
  topicTags: ["tech", "productivity", "AI"],
};

const VALID_RESPONSE = JSON.stringify({
  issues: [
    {
      id: "ai-tone-detected",
      severity: "medium",
      category: "tone",
      description: "Post sounds AI-generated",
      suggestion: "Add personal anecdotes or casual language",
    },
  ],
  rewrites: [
    {
      label: "More conversational tone",
      text: "Here is the rewritten post text...",
    },
  ],
  shareability: {
    score: 45,
    topTrigger: "voice of the reader",
    reasoning: "The post articulates a common frustration but lacks specificity.",
  },
  tone: "Formal and slightly generic, like a LinkedIn post.",
});

// ── buildScannerPrompt ────────────────────────────────────────────────

describe("buildScannerPrompt", () => {
  it("includes recent posts in the system prompt", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", FULL_CONTEXT);
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("AI is changing everything in tech.");
    expect(joined).toContain("most productivity advice is recycled.");
  });

  it("includes topic tags in the system prompt", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", FULL_CONTEXT);
    expect(flattenSystemBlocks(systemPrompt)).toContain("tech, productivity, AI");
  });

  it("handles empty recent posts gracefully", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", EMPTY_CONTEXT);
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("No recent posts available.");
    expect(joined).not.toContain("undefined");
  });

  it("handles empty topic tags gracefully", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", EMPTY_CONTEXT);
    expect(flattenSystemBlocks(systemPrompt)).toContain("No established topics yet.");
  });

  it("includes the draft text in the user message", () => {
    const { userMessage } = buildScannerPrompt("Check out my awesome post!", EMPTY_CONTEXT);
    expect(userMessage).toContain("Check out my awesome post!");
  });

  it("numbers recent posts with dates", () => {
    const { systemPrompt } = buildScannerPrompt("Draft", FULL_CONTEXT);
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("1. [2026-03-20T10:00:00Z]");
    expect(joined).toContain("2. [2026-03-18T08:00:00Z]");
  });

  it("marks the knowledge prefix as cacheable and the user suffix as uncached", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", FULL_CONTEXT);
    expect(systemPrompt.length).toBeGreaterThanOrEqual(2);
    expect(systemPrompt[0].cacheable).toBe(true);
    // The block containing per-user data must not be cacheable
    const variableBlock = systemPrompt.find((b) =>
      b.text.includes("AI is changing everything in tech."),
    );
    expect(variableBlock).toBeDefined();
    expect(variableBlock?.cacheable).toBeFalsy();
  });
});

// ── parseAndValidateResponse ──────────────────────────────────────────

describe("parseAndValidateResponse", () => {
  it("parses a valid JSON response", () => {
    const result = parseAndValidateResponse(VALID_RESPONSE);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].id).toBe("ai-tone-detected");
    expect(result.issues[0].severity).toBe("medium");
    expect(result.issues[0].category).toBe("tone");
    expect(result.rewrites).toHaveLength(1);
    expect(result.shareability.score).toBe(45);
    expect(result.tone).toContain("Formal");
  });

  it("strips markdown code fences", () => {
    const fenced = "```json\n" + VALID_RESPONSE + "\n```";
    const result = parseAndValidateResponse(fenced);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe("tone");
  });

  it("strips code fences without language tag", () => {
    const fenced = "```\n" + VALID_RESPONSE + "\n```";
    const result = parseAndValidateResponse(fenced);
    expect(result.issues).toHaveLength(1);
  });

  it("defaults missing rewrites to empty array", () => {
    const partial = JSON.stringify({
      issues: [],
      shareability: { score: 80, topTrigger: "none", reasoning: "Good post." },
      tone: "Casual",
    });
    const result = parseAndValidateResponse(partial);
    expect(result.rewrites).toEqual([]);
  });

  it("defaults missing shareability to zero score", () => {
    const partial = JSON.stringify({
      issues: [],
      rewrites: [],
      tone: "Casual",
    });
    const result = parseAndValidateResponse(partial);
    expect(result.shareability).toEqual({
      score: 0,
      topTrigger: "none",
      reasoning: "",
    });
  });

  it("defaults missing tone to empty string", () => {
    const partial = JSON.stringify({
      issues: [],
      rewrites: [],
      shareability: { score: 50, topTrigger: "none", reasoning: "OK" },
    });
    const result = parseAndValidateResponse(partial);
    expect(result.tone).toBe("");
  });

  it("filters issues with invalid severity", () => {
    const bad = JSON.stringify({
      issues: [
        { id: "good", severity: "high", category: "tone", description: "OK", suggestion: "OK" },
        { id: "bad", severity: "critical", category: "tone", description: "Bad", suggestion: "Bad" },
      ],
      rewrites: [],
      shareability: { score: 0, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    const result = parseAndValidateResponse(bad);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].id).toBe("good");
  });

  it("filters issues with invalid category", () => {
    const bad = JSON.stringify({
      issues: [
        { id: "valid", severity: "low", category: "coherence", description: "OK", suggestion: "OK" },
        { id: "invalid", severity: "low", category: "clickbait", description: "Bad", suggestion: "Bad" },
      ],
      rewrites: [],
      shareability: { score: 0, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    const result = parseAndValidateResponse(bad);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].id).toBe("valid");
  });

  it("generates IDs for issues missing them", () => {
    const noIds = JSON.stringify({
      issues: [
        { severity: "medium", category: "similarity", description: "Too similar", suggestion: "Change it" },
      ],
      rewrites: [],
      shareability: { score: 0, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    const result = parseAndValidateResponse(noIds);
    expect(result.issues[0].id).toBe("llm-similarity-0");
  });

  it("clamps shareability score to 0-100", () => {
    const over = JSON.stringify({
      issues: [],
      rewrites: [],
      shareability: { score: 150, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    expect(parseAndValidateResponse(over).shareability.score).toBe(100);

    const under = JSON.stringify({
      issues: [],
      rewrites: [],
      shareability: { score: -10, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    expect(parseAndValidateResponse(under).shareability.score).toBe(0);
  });

  it("throws on completely invalid JSON", () => {
    expect(() => parseAndValidateResponse("not json at all")).toThrow();
  });

  it("handles issues as non-array gracefully", () => {
    const bad = JSON.stringify({
      issues: "not an array",
      rewrites: [],
      shareability: { score: 50, topTrigger: "none", reasoning: "" },
      tone: "OK",
    });
    const result = parseAndValidateResponse(bad);
    expect(result.issues).toEqual([]);
  });
});
