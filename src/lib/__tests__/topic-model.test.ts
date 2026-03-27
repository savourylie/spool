import { describe, expect, it } from "vitest";
import {
  buildTopicModel,
  getTopicPerformanceComparison,
  getAudienceTopicFit,
  MIN_POSTS_PER_CLUSTER,
  TOP_POSTS_COUNT,
  OTHER_CLUSTER_NAME,
  TOPIC_COLORS,
  type TopicModelPost,
} from "../topic-model";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<TopicModelPost> = {}): TopicModelPost {
  return {
    topic_tag: "marketing",
    views: 1000,
    likes: 50,
    replies: 10,
    reposts: 5,
    quotes: 2,
    shares: 3,
    text_preview: "Test post content",
    published_at: "2026-03-15T12:00:00Z",
    ...overrides,
  };
}

function makePosts(
  count: number,
  overrides: Partial<TopicModelPost> = {},
): TopicModelPost[] {
  return Array.from({ length: count }, (_, i) =>
    makePost({ views: (i + 1) * 100, ...overrides }),
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("MIN_POSTS_PER_CLUSTER is 3", () => {
    expect(MIN_POSTS_PER_CLUSTER).toBe(3);
  });

  it("TOP_POSTS_COUNT is 3", () => {
    expect(TOP_POSTS_COUNT).toBe(3);
  });

  it("OTHER_CLUSTER_NAME is 'Other'", () => {
    expect(OTHER_CLUSTER_NAME).toBe("Other");
  });

  it("TOPIC_COLORS has 5 brand palette entries", () => {
    expect(TOPIC_COLORS).toHaveLength(5);
    expect(TOPIC_COLORS[0]).toBe("#8B5CF6");
    expect(TOPIC_COLORS[1]).toBe("#F472B6");
    expect(TOPIC_COLORS[2]).toBe("#FBBF24");
    expect(TOPIC_COLORS[3]).toBe("#34D399");
    expect(TOPIC_COLORS[4]).toBe("#64748B");
  });
});

// ---------------------------------------------------------------------------
// buildTopicModel — empty / minimal inputs
// ---------------------------------------------------------------------------

describe("buildTopicModel — empty/minimal inputs", () => {
  it("returns empty clusters for empty posts array", () => {
    const result = buildTopicModel([]);
    expect(result.clusters).toEqual([]);
    expect(result.totalPosts).toBe(0);
    expect(result.uniqueTopics).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildTopicModel — single topic
// ---------------------------------------------------------------------------

describe("buildTopicModel — single topic", () => {
  it("produces a single cluster with correct name and postCount", () => {
    const posts = makePosts(5, { topic_tag: "fitness" });
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].name).toBe("Fitness");
    expect(result.clusters[0].postCount).toBe(5);
    expect(result.uniqueTopics).toBe(1);
  });

  it("computes avgViews as arithmetic mean", () => {
    const posts = [
      makePost({ topic_tag: "tech", views: 100 }),
      makePost({ topic_tag: "tech", views: 200 }),
      makePost({ topic_tag: "tech", views: 300 }),
    ];
    const result = buildTopicModel(posts);
    expect(result.clusters[0].avgViews).toBe(200);
  });

  it("computes avgReplies as arithmetic mean", () => {
    const posts = [
      makePost({ topic_tag: "tech", replies: 6 }),
      makePost({ topic_tag: "tech", replies: 12 }),
      makePost({ topic_tag: "tech", replies: 18 }),
    ];
    const result = buildTopicModel(posts);
    expect(result.clusters[0].avgReplies).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// buildTopicModel — multiple topics
// ---------------------------------------------------------------------------

describe("buildTopicModel — multiple topics", () => {
  it("groups into separate clusters sorted by postCount descending", () => {
    const posts = [
      ...makePosts(6, { topic_tag: "marketing" }),
      ...makePosts(4, { topic_tag: "fitness" }),
      ...makePosts(5, { topic_tag: "tech" }),
      ...makePosts(3, { topic_tag: "food" }),
    ];
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(4);
    expect(result.clusters[0].name).toBe("Marketing");
    expect(result.clusters[0].postCount).toBe(6);
    expect(result.clusters[1].name).toBe("Tech");
    expect(result.clusters[1].postCount).toBe(5);
    expect(result.clusters[2].name).toBe("Fitness");
    expect(result.clusters[2].postCount).toBe(4);
    expect(result.clusters[3].name).toBe("Food");
    expect(result.clusters[3].postCount).toBe(3);
    expect(result.totalPosts).toBe(18);
    expect(result.uniqueTopics).toBe(4);
  });

  it("assigns distinct colors from TOPIC_COLORS", () => {
    const posts = [
      ...makePosts(5, { topic_tag: "a" }),
      ...makePosts(4, { topic_tag: "b" }),
      ...makePosts(3, { topic_tag: "c" }),
    ];
    const result = buildTopicModel(posts);

    expect(result.clusters[0].color).toBe(TOPIC_COLORS[0]);
    expect(result.clusters[1].color).toBe(TOPIC_COLORS[1]);
    expect(result.clusters[2].color).toBe(TOPIC_COLORS[2]);
  });
});

// ---------------------------------------------------------------------------
// buildTopicModel — "Other" bucket merging
// ---------------------------------------------------------------------------

describe("buildTopicModel — Other bucket", () => {
  it("merges posts with null topic_tag into Other", () => {
    const posts = [
      ...makePosts(5, { topic_tag: "tech" }),
      ...makePosts(3, { topic_tag: null }),
    ];
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(2);
    const other = result.clusters.find((c) => c.name === OTHER_CLUSTER_NAME);
    expect(other).toBeDefined();
    expect(other!.postCount).toBe(3);
  });

  it("merges posts with empty string topic_tag into Other", () => {
    const posts = [
      ...makePosts(4, { topic_tag: "tech" }),
      ...makePosts(3, { topic_tag: "" }),
    ];
    const result = buildTopicModel(posts);

    const other = result.clusters.find((c) => c.name === OTHER_CLUSTER_NAME);
    expect(other).toBeDefined();
    expect(other!.postCount).toBe(3);
  });

  it("merges topics with fewer than MIN_POSTS_PER_CLUSTER into Other", () => {
    const posts = [
      ...makePosts(5, { topic_tag: "tech" }),
      ...makePosts(2, { topic_tag: "tiny" }),
    ];
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(2);
    const other = result.clusters.find((c) => c.name === OTHER_CLUSTER_NAME);
    expect(other).toBeDefined();
    expect(other!.postCount).toBe(2);
  });

  it("places Other cluster last regardless of postCount", () => {
    const posts = [
      ...makePosts(3, { topic_tag: "tech" }),
      ...makePosts(10, { topic_tag: null }),
    ];
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(2);
    expect(result.clusters[0].name).toBe("Tech");
    expect(result.clusters[result.clusters.length - 1].name).toBe(
      OTHER_CLUSTER_NAME,
    );
  });

  it("returns single Other cluster when all posts lack topic_tags", () => {
    const posts = makePosts(5, { topic_tag: null });
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].name).toBe(OTHER_CLUSTER_NAME);
    expect(result.clusters[0].postCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// buildTopicModel — topPosts
// ---------------------------------------------------------------------------

describe("buildTopicModel — topPosts", () => {
  it("returns at most TOP_POSTS_COUNT entries", () => {
    const posts = makePosts(10, { topic_tag: "tech" });
    const result = buildTopicModel(posts);

    expect(result.clusters[0].topPosts.length).toBeLessThanOrEqual(
      TOP_POSTS_COUNT,
    );
    expect(result.clusters[0].topPosts).toHaveLength(TOP_POSTS_COUNT);
  });

  it("sorts topPosts by WES descending", () => {
    const posts = [
      makePost({ topic_tag: "tech", shares: 1, replies: 0 }),
      makePost({ topic_tag: "tech", shares: 10, replies: 0 }),
      makePost({ topic_tag: "tech", shares: 5, replies: 0 }),
    ];
    const result = buildTopicModel(posts);
    const wes = result.clusters[0].topPosts.map((p) => p.wes);
    expect(wes).toEqual([...wes].sort((a, b) => b - a));
  });

  it("returns all posts when cluster has fewer than TOP_POSTS_COUNT", () => {
    const posts = makePosts(3, { topic_tag: "tech" });
    const result = buildTopicModel(posts);

    expect(result.clusters[0].topPosts).toHaveLength(3);
  });

  it("includes correct fields on topPosts entries", () => {
    const posts = [
      makePost({
        topic_tag: "tech",
        views: 500,
        text_preview: "Hello world",
        published_at: "2026-01-01T00:00:00Z",
        likes: 10,
        replies: 5,
        reposts: 2,
        quotes: 1,
        shares: 3,
      }),
      makePost({ topic_tag: "tech" }),
      makePost({ topic_tag: "tech" }),
    ];
    const result = buildTopicModel(posts);
    const top = result.clusters[0].topPosts[0];

    expect(top).toHaveProperty("text_preview");
    expect(top).toHaveProperty("views");
    expect(top).toHaveProperty("wes");
    expect(top).toHaveProperty("published_at");
    expect(typeof top.wes).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// buildTopicModel — color cycling
// ---------------------------------------------------------------------------

describe("buildTopicModel — color cycling", () => {
  it("cycles colors when more topics than TOPIC_COLORS length", () => {
    const posts = [
      ...makePosts(3, { topic_tag: "a" }),
      ...makePosts(3, { topic_tag: "b" }),
      ...makePosts(3, { topic_tag: "c" }),
      ...makePosts(3, { topic_tag: "d" }),
      ...makePosts(3, { topic_tag: "e" }),
      ...makePosts(3, { topic_tag: "f" }),
    ];
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(6);
    expect(result.clusters[5].color).toBe(TOPIC_COLORS[0]);
  });

  it("assigns first cluster the primary brand color", () => {
    const posts = [
      ...makePosts(5, { topic_tag: "alpha" }),
      ...makePosts(3, { topic_tag: "beta" }),
    ];
    const result = buildTopicModel(posts);
    expect(result.clusters[0].color).toBe("#8B5CF6");
  });
});

// ---------------------------------------------------------------------------
// buildTopicModel — edge cases
// ---------------------------------------------------------------------------

describe("buildTopicModel — edge cases", () => {
  it("handles single-topic account", () => {
    const posts = makePosts(20, { topic_tag: "marketing" });
    const result = buildTopicModel(posts);

    expect(result.clusters).toHaveLength(1);
    expect(result.uniqueTopics).toBe(1);
    expect(result.clusters[0].name).toBe("Marketing");
  });

  it("handles posts with 0 views without division error", () => {
    const posts = makePosts(3, { topic_tag: "tech", views: 0 });
    const result = buildTopicModel(posts);

    expect(result.clusters[0].avgEngagement).toBe(0);
    expect(Number.isFinite(result.clusters[0].avgWes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTopicPerformanceComparison
// ---------------------------------------------------------------------------

describe("getTopicPerformanceComparison", () => {
  it("returns empty array for empty clusters", () => {
    expect(getTopicPerformanceComparison([])).toEqual([]);
  });

  it("returns entries sorted by avgWes descending", () => {
    const { clusters } = buildTopicModel([
      ...makePosts(5, { topic_tag: "tech", shares: 10 }),
      ...makePosts(5, { topic_tag: "food", shares: 1 }),
    ]);
    const bars = getTopicPerformanceComparison(clusters);

    expect(bars[0].avgWes).toBeGreaterThanOrEqual(bars[1].avgWes);
  });

  it("preserves name, color, and metric fields", () => {
    const { clusters } = buildTopicModel(makePosts(5, { topic_tag: "tech" }));
    const bars = getTopicPerformanceComparison(clusters);

    expect(bars[0]).toHaveProperty("name");
    expect(bars[0]).toHaveProperty("color");
    expect(bars[0]).toHaveProperty("avgViews");
    expect(bars[0]).toHaveProperty("avgEngagement");
    expect(bars[0]).toHaveProperty("avgReplies");
    expect(bars[0]).toHaveProperty("avgWes");
  });
});

// ---------------------------------------------------------------------------
// getAudienceTopicFit
// ---------------------------------------------------------------------------

describe("getAudienceTopicFit", () => {
  it("returns empty array for empty clusters", () => {
    expect(getAudienceTopicFit([], [])).toEqual([]);
  });

  it("labels above-average topic as strong", () => {
    const { clusters } = buildTopicModel([
      ...makePosts(5, { topic_tag: "tech", shares: 20, views: 100 }),
      ...makePosts(5, { topic_tag: "food", shares: 1, views: 100 }),
    ]);
    const fit = getAudienceTopicFit(clusters, []);
    const techFit = fit.find((f) => f.topicName === "Tech");
    expect(techFit!.fitLabel).toBe("strong");
    expect(techFit!.relativePerformance).toBeGreaterThan(10);
  });

  it("labels below-average topic as weak", () => {
    const { clusters } = buildTopicModel([
      ...makePosts(5, { topic_tag: "tech", shares: 20, views: 100 }),
      ...makePosts(5, { topic_tag: "food", shares: 1, views: 100 }),
    ]);
    const fit = getAudienceTopicFit(clusters, []);
    const foodFit = fit.find((f) => f.topicName === "Food");
    expect(foodFit!.fitLabel).toBe("weak");
    expect(foodFit!.relativePerformance).toBeLessThan(-10);
  });

  it("sorts by relativePerformance descending", () => {
    const { clusters } = buildTopicModel([
      ...makePosts(5, { topic_tag: "tech", shares: 20, views: 100 }),
      ...makePosts(5, { topic_tag: "food", shares: 5, views: 100 }),
      ...makePosts(5, { topic_tag: "art", shares: 1, views: 100 }),
    ]);
    const fit = getAudienceTopicFit(clusters, []);

    for (let i = 0; i < fit.length - 1; i++) {
      expect(fit[i].relativePerformance).toBeGreaterThanOrEqual(
        fit[i + 1].relativePerformance,
      );
    }
  });

  it("returns average fit for single-cluster account", () => {
    const { clusters } = buildTopicModel(makePosts(10, { topic_tag: "tech" }));
    const fit = getAudienceTopicFit(clusters, []);

    expect(fit).toHaveLength(1);
    expect(fit[0].relativePerformance).toBe(0);
    expect(fit[0].fitLabel).toBe("average");
  });

  it("works with empty demographics array", () => {
    const { clusters } = buildTopicModel([
      ...makePosts(5, { topic_tag: "tech" }),
      ...makePosts(5, { topic_tag: "food" }),
    ]);
    expect(() => getAudienceTopicFit(clusters, [])).not.toThrow();
  });
});
