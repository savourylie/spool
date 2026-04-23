import { describe, expect, it, vi } from "vitest";
import {
  APPROX_CHARS_PER_TOKEN,
  MIN_POSTS_FOR_SUGGESTIONS,
  SUGGESTION_COUNT,
  TOPIC_SUGGESTIONS_TIMEOUT_MS,
  buildTopicSuggestionsPrompt,
  buildFallbackTopicSuggestions,
  estimateGeneratedTokens,
  parseTopicSuggestions,
  generateTopicSuggestions,
  streamTopicSuggestions,
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

async function* streamChunks(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
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

  it("APPROX_CHARS_PER_TOKEN is 4", () => {
    expect(APPROX_CHARS_PER_TOKEN).toBe(4);
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

  it("extracts the first JSON array from surrounding prose", () => {
    const wrapped =
      "Here are your suggestions:\n" +
      JSON.stringify(VALID_SUGGESTIONS) +
      "\nThese should work well.";

    const result = parseTopicSuggestions(wrapped);

    expect(result).toHaveLength(3);
    expect(result[1].name).toBe("Remote Work Culture");
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

  it("dedupes repeated suggestions by name", () => {
    const input = [
      VALID_SUGGESTIONS[0],
      { ...VALID_SUGGESTIONS[0], rationale: "Duplicate entry" },
      VALID_SUGGESTIONS[1],
    ];

    const result = parseTopicSuggestions(JSON.stringify(input));

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("AI Ethics Debates");
    expect(result[1].name).toBe("Remote Work Culture");
  });
});

describe("estimateGeneratedTokens", () => {
  it("returns 0 for blank text", () => {
    expect(estimateGeneratedTokens("")).toBe(0);
    expect(estimateGeneratedTokens("   ")).toBe(0);
  });

  it("estimates tokens from character length", () => {
    expect(estimateGeneratedTokens("1234")).toBe(1);
    expect(estimateGeneratedTokens("12345")).toBe(2);
    expect(estimateGeneratedTokens("12345678")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// generateTopicSuggestions
// ---------------------------------------------------------------------------

describe("buildFallbackTopicSuggestions", () => {
  it("returns deterministic suggestions from extracted topic clusters", () => {
    const posts = [
      makePost("Marketing strategy for startups and growth hacking"),
      makePost("Marketing brand building and growth metrics"),
      makePost("Marketing funnel optimization and brand strategy"),
      makePost("Growth marketing strategy for digital brands"),
      makePost("Design systems and figma components"),
      makePost("Design principles for modern figma interfaces"),
      makePost("User interface design with figma prototyping"),
    ];

    const result = buildFallbackTopicSuggestions(posts);

    expect(result.coreTopics.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].name).toBeTruthy();
    expect(result.suggestions[0].rationale).toContain("Recurring theme");
  });
});

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
    expect(mockLlm.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: TOPIC_SUGGESTIONS_TIMEOUT_MS,
      }),
    );
    expect(result.suggestions).toHaveLength(3);
    expect(result.coreTopics.length).toBeGreaterThan(0);
    expect(result.suggestions[0].name).toBe("AI Ethics Debates");
  });

  it("falls back when the model returns an empty suggestion list", async () => {
    const mockLlm = {
      generate: vi.fn().mockResolvedValue("[]"),
    } as unknown as ILLMClient;

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

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].rationale).toMatch(/Recurring theme|Related keyword/);
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

describe("streamTopicSuggestions", () => {
  it("streams progress updates and returns parsed suggestions", async () => {
    const serialized = JSON.stringify(VALID_SUGGESTIONS);
    const mockLlm = {
      generateStreamIterator: vi.fn().mockReturnValue(
        streamChunks([serialized.slice(0, 24), serialized.slice(24)]),
      ),
    } as unknown as ILLMClient;

    const posts = [
      makePost("Marketing strategy for startups and growth hacking"),
      makePost("Marketing brand building and growth metrics"),
      makePost("Marketing funnel optimization and brand strategy"),
      makePost("Growth marketing strategy for digital brands"),
      makePost("Design systems and figma components"),
      makePost("Design principles for modern figma interfaces"),
      makePost("User interface design with figma prototyping"),
    ];

    const progress: number[] = [];
    const result = await streamTopicSuggestions(posts, mockLlm, ({ generatedTokens }) => {
      progress.push(generatedTokens);
    });

    expect(mockLlm.generateStreamIterator).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: TOPIC_SUGGESTIONS_TIMEOUT_MS,
      }),
    );
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBeGreaterThan(0);
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0].name).toBe("AI Ethics Debates");
  });

  it("falls back when the streamed model output is empty", async () => {
    const mockLlm = {
      generateStreamIterator: vi.fn().mockReturnValue(streamChunks(["[]"])),
    } as unknown as ILLMClient;

    const posts = [
      makePost("Marketing strategy for startups and growth hacking"),
      makePost("Marketing brand building and growth metrics"),
      makePost("Marketing funnel optimization and brand strategy"),
      makePost("Growth marketing strategy for digital brands"),
      makePost("Design systems and figma components"),
      makePost("Design principles for modern figma interfaces"),
      makePost("User interface design with figma prototyping"),
    ];

    const result = await streamTopicSuggestions(posts, mockLlm);

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].rationale).toMatch(/Recurring theme|Related keyword/);
  });
});
