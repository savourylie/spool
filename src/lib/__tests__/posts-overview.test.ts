import { describe, expect, it } from "vitest";

import { parseOverview } from "../posts-overview";

describe("parseOverview", () => {
  it("normalizes the aggregate RPC row", () => {
    const overview = parseOverview({
      total_posts: 12,
      total_views: 4200,
      total_interactions: 210,
      engagement_rate: 5,
      media_breakdown: [
        {
          media_type: "CAROUSEL",
          posts: 3,
          views: 1800,
          avg_views: 600,
          engagement_rate: 7.5,
        },
      ],
      top_post: {
        id: "post-1",
        text_preview: "Hello",
        media_type: "TEXT",
        views: 1200,
        permalink: "https://threads.com/@user/post/1",
        published_at: "2026-10-01T00:00:00Z",
      },
    });

    expect(overview).toEqual({
      totalPosts: 12,
      totalViews: 4200,
      totalInteractions: 210,
      engagementRate: 5,
      mediaBreakdown: [
        {
          mediaType: "CAROUSEL",
          posts: 3,
          views: 1800,
          avgViews: 600,
          engagementRate: 7.5,
        },
      ],
      topPost: {
        id: "post-1",
        textPreview: "Hello",
        mediaType: "TEXT",
        views: 1200,
        permalink: "https://threads.com/@user/post/1",
        publishedAt: "2026-10-01T00:00:00Z",
      },
    });
  });

  it("falls back to zeroes for missing or malformed values", () => {
    const overview = parseOverview({
      total_posts: 0,
      total_views: 0,
      total_interactions: 0,
      engagement_rate: 0,
      media_breakdown: null,
      top_post: null,
    });

    expect(overview?.mediaBreakdown).toEqual([]);
    expect(overview?.topPost).toBeNull();
    expect(parseOverview(null)).toBeNull();
  });
});
