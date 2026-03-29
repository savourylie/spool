import { describe, expect, it, vi } from "vitest";
import {
  MIN_POSTS_FOR_SUGGESTIONS,
  SUGGESTION_COUNT,
  buildTopicSuggestionsPrompt,
  parseTopicSuggestions,
  generateTopicSuggestions,
  type TopicSuggestion,
} from "@/lib/topic-suggestions";
import type { TopicCluster, TopicPost } from "@/lib/topic-classification";
import type { ILLMClient } from "@/lib/llm-provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(text: string | null): TopicPost {
  return { text };
}

function makeCluster(
  topic: string,
  keywords: string[],
  score: number,
): TopicCluster {
  return { topic, keywords, score };
}

const VALID_SUGGESTIONS: TopicSuggestion[] = [
  {
    name: "AI Ethics Debates",
    relevanceScore: 88,
    semanticDistance: "near",
    rationale: "Direct extension of your AI content.",
  },
  {
    name: "Remote Work Culture",
    relevanceScore: 62,
    semanticDistance: "medium",
    rationale: "Your tech audience overlaps with remote workers.",
  },
  {
    name: "Urban Gardening",
    relevanceScore: 30,
    semanticDistance: "far",
    rationale: "Creative crossover for lifestyle content.",
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("MIN_POSTS_FOR_SUGGESTIONS is 5", () => {
    expect(MIN_POSTS_FOR_SUGGESTIONS).toBe(5);
  });

  it("SUGGESTION_COUNT is 8", () => {
    expect(SUGGESTION_COUNT).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// buildTopicSuggestionsPrompt
// ---------------------------------------------------------------------------

describe("buildTopicSuggestionsPrompt", () => {
  const clusters = [
    makeCluster("marketing", ["marketing", "brand", "growth"], 2.5),
    makeCluster("design", ["design", "figma", "ui"], 1.8),
  ];

  it("returns systemPrompt and userMessage", () => {
    const result = buildTopicSuggestionsPrompt(
      ["marketing", "design"],
      clusters,
    );
    expect(result).toHaveProperty("systemPrompt");
    expect(result).toHaveProperty("userMessage");
    expect(typeof result.systemPrompt).toBe("string");
    expect(typeof result.userMessage).toBe("string");
  });

  it("includes topic names in userMessage", () => {
    const { userMessage } = buildTopicSuggestionsPrompt(
      ["marketing", "design"],
      clusters,
    );
    expect(userMessage).toContain("marketing");
    expect(userMessage).toContain("design");
  });

  it("includes keywords from clusters", () => {
    const { userMessage } = buildTopicSuggestionsPrompt(
      ["marketing", "design"],
      clusters,
    );
    expect(userMessage).toContain("brand");
    expect(userMessage).toContain("figma");
  });

  it("includes cluster scores", () => {
    const { userMessage } = buildTopicSuggestionsPrompt(
      ["marketing", "design"],
      clusters,
    );
    expect(userMessage).toContain("2.50");
    expect(userMessage).toContain("1.80");
  });
});

// ---------------------------------------------------------------------------
// parseTopicSuggestions
// ---------------------------------------------------------------------------

describe("parseTopicSuggestions", () => {
  it("parses valid JSON array", () => {
    const result = parseTopicSuggestions(JSON.stringify(VALID_SUGGESTIONS));
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("AI Ethics Debates");
    expect(result[0].relevanceScore).toBe(88);
    expect(result[0].semanticDistance).toBe("near");
    expect(result[0].rationale).toBe("Direct extension of your AI content.");
  });

  it("handles JSON wrapped in markdown fences", () => {
    const wrapped = "```json\n" + JSON.stringify(VALID_SUGGESTIONS) + "\n```";
    const result = parseTopicSuggestions(wrapped);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("AI Ethics Debates");
  });

  it("handles markdown fences without language tag", () => {
    const wrapped = "```\n" + JSON.stringify(VALID_SUGGESTIONS) + "\n```";
    const result = parseTopicSuggestions(wrapped);
    expect(result).toHaveLength(3);
  });

  it("filters out items with missing name", () => {
    const input = [
      { relevanceScore: 80, semanticDistance: "near", rationale: "No name" },
      ...VALID_SUGGESTIONS,
    ];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result).toHaveLength(3);
  });

  it("filters out items with empty name", () => {
    const input = [
      { name: "  ", relevanceScore: 80, semanticDistance: "near", rationale: "Blank" },
      ...VALID_SUGGESTIONS,
    ];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result).toHaveLength(3);
  });

  it("clamps relevanceScore above 100 to 100", () => {
    const input = [{ name: "Test", relevanceScore: 150, semanticDistance: "near", rationale: "" }];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result[0].relevanceScore).toBe(100);
  });

  it("clamps relevanceScore below 0 to 0", () => {
    const input = [{ name: "Test", relevanceScore: -10, semanticDistance: "near", rationale: "" }];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result[0].relevanceScore).toBe(0);
  });

  it("defaults non-finite relevanceScore to 50", () => {
    const input = [{ name: "Test", relevanceScore: "invalid", semanticDistance: "near", rationale: "" }];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result[0].relevanceScore).toBe(50);
  });

  it("defaults invalid semanticDistance to medium", () => {
    const input = [{ name: "Test", relevanceScore: 70, semanticDistance: "unknown", rationale: "" }];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result[0].semanticDistance).toBe("medium");
  });

  it("defaults missing semanticDistance to medium", () => {
    const input = [{ name: "Test", relevanceScore: 70, rationale: "" }];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result[0].semanticDistance).toBe("medium");
  });

  it("coerces non-string rationale to empty string", () => {
    const input = [{ name: "Test", relevanceScore: 70, semanticDistance: "near", rationale: 42 }];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result[0].rationale).toBe("");
  });

  it("returns empty array for empty JSON array", () => {
    const result = parseTopicSuggestions("[]");
    expect(result).toHaveLength(0);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseTopicSuggestions("not json")).toThrow();
  });

  it("throws on non-array JSON", () => {
    expect(() => parseTopicSuggestions('{"key": "value"}')).toThrow(
      "Expected JSON array",
    );
  });

  it("rounds relevanceScore to integer", () => {
    const input = [{ name: "Test", relevanceScore: 73.7, semanticDistance: "near", rationale: "" }];
    const result = parseTopicSuggestions(JSON.stringify(input));
    expect(result[0].relevanceScore).toBe(74);
  });
});

// ---------------------------------------------------------------------------
// generateTopicSuggestions
// ---------------------------------------------------------------------------

describe("generateTopicSuggestions", () => {
  it("returns empty result for empty posts", async () => {
    const mockLlm = { generate: vi.fn() } as unknown as ILLMClient;
    const result = await generateTopicSuggestions([], mockLlm);
    expect(result.suggestions).toHaveLength(0);
    expect(result.coreTopics).toHaveLength(0);
    expect(mockLlm.generate).not.toHaveBeenCalled();
  });

  it("returns empty result for posts with null text", async () => {
    const mockLlm = { generate: vi.fn() } as unknown as ILLMClient;
    const posts = [makePost(null), makePost(null)];
    const result = await generateTopicSuggestions(posts, mockLlm);
    expect(result.suggestions).toHaveLength(0);
    expect(result.coreTopics).toHaveLength(0);
  });

  it("calls LLM and returns parsed suggestions for valid posts", async () => {
    const mockLlm = {
      generate: vi.fn().mockResolvedValue(JSON.stringify(VALID_SUGGESTIONS)),
    } as unknown as ILLMClient;

    // Create enough varied posts to produce topic clusters
    const posts = [
      makePost("Marketing strategy for startups and growth hacking"),
      makePost("Marketing brand building and growth metrics"),
      makePost("Marketing funnel optimization and brand strategy"),
      makePost("Growth marketing strategy for digital brands"),
      makePost("Design systems and figma components"),
      makePost("Design principles for modern figma interfaces"),
      makePost("User interface design with figma prototyping"),
    ];

    const result = await generateTopicSuggestions(posts, mockLlm);
    expect(mockLlm.generate).toHaveBeenCalledTimes(1);
    expect(result.suggestions).toHaveLength(3);
    expect(result.coreTopics.length).toBeGreaterThan(0);
    expect(result.suggestions[0].name).toBe("AI Ethics Debates");
  });

  it("propagates LLM errors", async () => {
    const mockLlm = {
      generate: vi.fn().mockRejectedValue(new Error("LLM unavailable")),
    } as unknown as ILLMClient;

    const posts = [
      makePost("Marketing strategy for startups and growth hacking"),
      makePost("Marketing brand building and growth metrics"),
      makePost("Marketing funnel optimization and brand strategy"),
      makePost("Growth marketing strategy for digital brands"),
    ];

    await expect(generateTopicSuggestions(posts, mockLlm)).rejects.toThrow(
      "LLM unavailable",
    );
  });
});
