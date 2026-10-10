import { type NextRequest, NextResponse } from "next/server";

import { formatNumber } from "@/lib/engagement-prediction";
import { getSession } from "@/lib/session";

// ── Types ──────────────────────────────────────────────────────────────

export interface YouTubeVideo {
  title: string;
  channelName: string;
  viewCount: string;
  thumbnailUrl: string;
  videoUrl: string;
  matchedTopic: string;
  publishedAt: string;
}

// ── Cache ──────────────────────────────────────────────────────────────

const cache = new Map<string, { data: YouTubeVideo[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCacheKey(topics: string[]): string {
  return topics
    .map((t) => t.toLowerCase().trim())
    .sort()
    .join("|");
}

function sweepStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL * 2) {
      cache.delete(key);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function matchTopic(videoTitle: string, topics: string[]): string {
  const titleWords = new Set(videoTitle.toLowerCase().split(/\s+/));
  let best = topics[0] ?? "";
  let bestScore = 0;

  for (const topic of topics) {
    const topicWords = topic.toLowerCase().split(/\s+/);
    const score =
      topicWords.filter((w) => titleWords.has(w)).length / topicWords.length;
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }

  return best;
}

function formatViewCount(raw: string | undefined): string {
  const n = Number(raw);
  if (!n || isNaN(n)) return "Popular";
  return `${formatNumber(n)} views`;
}

// ── Route ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // Auth
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate body
  let body: { topics?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !Array.isArray(body.topics) ||
    body.topics.length === 0 ||
    !body.topics.every((t: unknown) => typeof t === "string" && t.trim())
  ) {
    return NextResponse.json(
      { error: "topics must be a non-empty array of strings" },
      { status: 400 },
    );
  }

  const topics = body.topics as string[];

  // Check API key — graceful degradation
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ videos: [] });
  }

  // Cache check
  const cacheKey = getCacheKey(topics);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ videos: cached.data });
  }

  try {
    // Search for videos
    const query = topics.join("|");
    const publishedAfter = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: "6",
      order: "relevance",
      publishedAfter,
      relevanceLanguage: "en",
      key: apiKey,
    });

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams}`,
    );

    if (!searchRes.ok) {
      console.error(
        `YouTube search API error: ${searchRes.status} ${searchRes.statusText}`,
      );
      return NextResponse.json({ videos: [] });
    }

    const searchData = await searchRes.json();
    const items: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails: { medium?: { url: string } };
      };
    }> = searchData.items ?? [];

    if (items.length === 0) {
      return NextResponse.json({ videos: [] });
    }

    // Fetch view counts for all videos in one batch
    const videoIds = items.map((item) => item.id.videoId).join(",");
    const statsParams = new URLSearchParams({
      part: "statistics",
      id: videoIds,
      key: apiKey,
    });

    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${statsParams}`,
    );

    const viewCounts = new Map<string, string>();
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      for (const item of statsData.items ?? []) {
        viewCounts.set(item.id, item.statistics?.viewCount);
      }
    }

    // Build response
    const videos: YouTubeVideo[] = items.map((item) => ({
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      viewCount: formatViewCount(viewCounts.get(item.id.videoId)),
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? "",
      videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      matchedTopic: matchTopic(item.snippet.title, topics),
      publishedAt: item.snippet.publishedAt,
    }));

    // Cache write + sweep
    cache.set(cacheKey, { data: videos, timestamp: Date.now() });
    sweepStaleEntries();

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("YouTube suggestions failed:", error);
    return NextResponse.json({ videos: [] });
  }
}
