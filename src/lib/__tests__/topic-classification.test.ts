import { describe, expect, it } from "vitest";
import {
  STOP_WORDS,
  DEFAULT_TOP_N,
  tokenize,
  extractTopics,
  classifyPostTopic,
  computeFocusScore,
  type TopicPost,
  type TopicCluster,
  type FocusPost,
} from "@/lib/topic-classification";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(text: string | null): TopicPost {
  return { text };
}

function makeFocusPost(tag: string | null): FocusPost {
  return { topic_tag: tag };
}

// ---------------------------------------------------------------------------
// STOP_WORDS
// ---------------------------------------------------------------------------

describe("STOP_WORDS", () => {
  it("contains common English stop words", () => {
    for (const word of ["the", "a", "is", "and", "of", "in", "to"]) {
      expect(STOP_WORDS.has(word)).toBe(true);
    }
  });

  it("does not contain content words", () => {
    for (const word of ["marketing", "strategy", "design", "algorithm"]) {
      expect(STOP_WORDS.has(word)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe("tokenize", () => {
  it("returns empty array for empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("lowercases text", () => {
    expect(tokenize("Marketing Strategy")).toContain("marketing");
    expect(tokenize("Marketing Strategy")).toContain("strategy");
  });

  it("strips punctuation", () => {
    const tokens = tokenize("design-driven, user-focused!");
    expect(tokens).toContain("design");
    expect(tokens).toContain("driven");
    expect(tokens).toContain("user");
    expect(tokens).toContain("focused");
  });

  it("removes stop words", () => {
    const tokens = tokenize("the best strategy for your marketing");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("for");
    expect(tokens).not.toContain("your");
    expect(tokens).toContain("best");
    expect(tokens).toContain("strategy");
    expect(tokens).toContain("marketing");
  });

  it("filters tokens shorter than MIN_TOKEN_LENGTH", () => {
    const tokens = tokenize("AI is an ok ML tool");
    // "ai", "is", "an", "ok", "ml" are all < 3 chars or stop words
    expect(tokens).toContain("tool");
    expect(tokens).not.toContain("ai");
    expect(tokens).not.toContain("ml");
  });

  it("handles emoji and special characters", () => {
    const tokens = tokenize("🚀 launching product today 🎉");
    expect(tokens).toContain("launching");
    expect(tokens).toContain("product");
    expect(tokens).toContain("today");
  });
});

// ---------------------------------------------------------------------------
// extractTopics
// ---------------------------------------------------------------------------

describe("extractTopics", () => {
  it("returns empty array for empty posts", () => {
    expect(extractTopics([])).toEqual([]);
  });

  it("returns empty array when all posts have null text", () => {
    expect(extractTopics([makePost(null), makePost(null)])).toEqual([]);
  });

  it("returns empty array when all posts have empty text", () => {
    expect(extractTopics([makePost(""), makePost("   ")])).toEqual([]);
  });

  it("extracts topics from a single post", () => {
    const posts = [makePost("marketing strategy content creation branding")];
    const topics = extractTopics(posts);
    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0].topic).toBeTruthy();
    expect(topics[0].keywords.length).toBeGreaterThan(0);
  });

  it("returns the dominant topic first when posts share a theme", () => {
    const posts = [
      makePost("javascript react frontend development building components"),
      makePost("react components frontend hooks state management"),
      makePost("frontend development react typescript coding"),
      makePost("cooking pasta italian recipes dinner preparation"),
    ];
    const topics = extractTopics(posts);
    expect(topics.length).toBeGreaterThan(0);
    // The top topic should be related to frontend/react (3 of 4 posts)
    const topKeywords = topics[0].keywords;
    const hasFrontendTerms = topKeywords.some((kw) =>
      ["react", "frontend", "components", "development"].includes(kw),
    );
    expect(hasFrontendTerms).toBe(true);
  });

  it("respects topN parameter", () => {
    const posts = [
      makePost("marketing branding strategy growth content"),
      makePost("engineering software development coding programming"),
      makePost("design visual creative artwork illustration"),
      makePost("fitness health workout nutrition training"),
      makePost("travel adventure hiking nature exploration"),
      makePost("cooking recipes food preparation kitchen"),
    ];
    const topics = extractTopics(posts, 2);
    expect(topics.length).toBeLessThanOrEqual(2);
  });

  it("skips null text posts but processes valid ones", () => {
    const posts = [
      makePost(null),
      makePost("software engineering development coding"),
      makePost(null),
      makePost("engineering programming software architecture"),
    ];
    const topics = extractTopics(posts);
    expect(topics.length).toBeGreaterThan(0);
  });

  it("uses DEFAULT_TOP_N when topN is not specified", () => {
    // Create enough varied posts to potentially generate many topics
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost(`unique${i} topic${i} content${i} subject${i} theme${i}`),
    );
    const topics = extractTopics(posts);
    expect(topics.length).toBeLessThanOrEqual(DEFAULT_TOP_N);
  });
});

// ---------------------------------------------------------------------------
// classifyPostTopic
// ---------------------------------------------------------------------------

describe("classifyPostTopic", () => {
  const sampleClusters: TopicCluster[] = [
    {
      topic: "marketing",
      keywords: ["marketing", "branding", "strategy", "growth", "content"],
      score: 5,
    },
    {
      topic: "engineering",
      keywords: ["engineering", "software", "coding", "development"],
      score: 4,
    },
  ];

  it("returns null for null text", () => {
    expect(classifyPostTopic(null, sampleClusters)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(classifyPostTopic("", sampleClusters)).toBeNull();
  });

  it("returns null for whitespace-only text", () => {
    expect(classifyPostTopic("   ", sampleClusters)).toBeNull();
  });

  it("returns null for empty clusters", () => {
    expect(classifyPostTopic("some marketing text", [])).toBeNull();
  });

  it("classifies a post matching a cluster", () => {
    const result = classifyPostTopic(
      "Our marketing strategy for branding growth",
      sampleClusters,
    );
    expect(result).not.toBeNull();
    expect(result!.topic).toBe("marketing");
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it("returns the best matching cluster", () => {
    const result = classifyPostTopic(
      "software engineering coding development practices",
      sampleClusters,
    );
    expect(result).not.toBeNull();
    expect(result!.topic).toBe("engineering");
  });

  it("returns null when no keywords match", () => {
    const result = classifyPostTopic(
      "cooking pasta dinner recipes",
      sampleClusters,
    );
    expect(result).toBeNull();
  });

  it("confidence reflects the match ratio", () => {
    // Post matches 2 of 5 marketing keywords
    const result = classifyPostTopic(
      "marketing strategy",
      sampleClusters,
    );
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(2 / 5);
  });

  it("respects MIN_CONFIDENCE threshold", () => {
    // Cluster with many keywords, post matches very few
    const bigCluster: TopicCluster[] = [
      {
        topic: "broad",
        keywords: Array.from({ length: 20 }, (_, i) => `keyword${i}`),
        score: 10,
      },
    ];
    // Only match 1 of 20 = 0.05 confidence, below MIN_CONFIDENCE (0.1)
    const result = classifyPostTopic("keyword0 other text here", bigCluster);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeFocusScore
// ---------------------------------------------------------------------------

describe("computeFocusScore", () => {
  it("returns 0 for empty array", () => {
    expect(computeFocusScore([])).toBe(0);
  });

  it("returns 100 when all posts have the same tag", () => {
    const posts = [
      makeFocusPost("marketing"),
      makeFocusPost("marketing"),
      makeFocusPost("marketing"),
    ];
    expect(computeFocusScore(posts)).toBe(100);
  });

  it("returns 0 when all posts have null tags", () => {
    const posts = [makeFocusPost(null), makeFocusPost(null)];
    expect(computeFocusScore(posts)).toBe(0);
  });

  it("counts null tags against the score", () => {
    const posts = [
      makeFocusPost("marketing"),
      makeFocusPost(null),
    ];
    // 1 matching / 2 total = 50
    expect(computeFocusScore(posts)).toBe(50);
  });

  it("uses top 3 tags for scoring", () => {
    const posts = [
      makeFocusPost("marketing"),
      makeFocusPost("marketing"),
      makeFocusPost("engineering"),
      makeFocusPost("engineering"),
      makeFocusPost("design"),
      makeFocusPost("design"),
      makeFocusPost("cooking"),
      makeFocusPost("cooking"),
    ];
    // Top 3 tags: marketing(2), engineering(2), design(2) = 6 matching / 8 total
    expect(computeFocusScore(posts)).toBe(75);
  });

  it("returns 100 for a single tagged post", () => {
    expect(computeFocusScore([makeFocusPost("tech")])).toBe(100);
  });

  it("handles many distinct tags correctly", () => {
    const posts = [
      makeFocusPost("a"),
      makeFocusPost("b"),
      makeFocusPost("c"),
      makeFocusPost("d"),
      makeFocusPost("e"),
    ];
    // Top 3 are a, b, c (1 each) = 3 matching / 5 total = 60
    expect(computeFocusScore(posts)).toBe(60);
  });
});
