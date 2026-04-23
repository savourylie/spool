// Server-side wrapper around the xAI Responses API for trending-topic search.
// Extracted from /api/grok-search/route.ts so both the route (TICKET-059) and
// the freshness gate (TICKET-071) can share the implementation without an
// HTTP self-call.

export interface TrendingTopic {
  title: string;
  postCount: string;
  matchedTopic: string;
  relevanceScore: number;
}

export interface GrokSearchResult {
  trends: TrendingTopic[];
  // true when XAI_API_KEY is not configured. The caller can use this to
  // distinguish "no trends found" from "we couldn't ask." Parse failures and
  // upstream errors still return unavailable=false with an empty trends list.
  unavailable: boolean;
}

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function parseTrends(raw: string, validTopics: string[]): TrendingTopic[] {
  try {
    const cleaned = stripMarkdownFences(raw);
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed) ? parsed : [];

    return arr
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.title === "string" && item.title.trim().length > 0,
      )
      .slice(0, 5)
      .map((item: Record<string, unknown>) => ({
        title: String(item.title).trim(),
        postCount:
          typeof item.postCount === "string" ? item.postCount : "Trending now",
        matchedTopic:
          typeof item.matchedTopic === "string" &&
          validTopics.some(
            (t) => t.toLowerCase() === String(item.matchedTopic).toLowerCase(),
          )
            ? String(item.matchedTopic)
            : validTopics[0] ?? "",
        relevanceScore: Math.max(
          0,
          Math.min(100, Number(item.relevanceScore) || 50),
        ),
      }));
  } catch {
    return [];
  }
}

function buildPrompt(topics: string[]): string {
  const topicList = topics.join(", ");
  return `What are the top 3-5 trending topics on X (Twitter) right now that are related to these subjects: ${topicList}?

Return ONLY a JSON array with no extra text. Each object must have:
- "title": the trending topic name or hashtag
- "postCount": approximate engagement as a short string like "12K posts today" or "5.2K posts"
- "matchedTopic": which of my topics (${topicList}) it most closely relates to — must be one of those exact strings
- "relevanceScore": 0-100 how relevant this trend is to my topics

Example format:
[
  { "title": "#AIAgents", "postCount": "23K posts today", "matchedTopic": "AI agents", "relevanceScore": 85 }
]`;
}

export async function searchTrends(
  topics: string[],
): Promise<GrokSearchResult> {
  if (topics.length === 0) {
    return { trends: [], unavailable: false };
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { trends: [], unavailable: true };
  }

  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.20-reasoning",
        input: [{ role: "user", content: buildPrompt(topics) }],
        tools: [{ type: "x_search" }],
      }),
    });

    if (!res.ok) {
      console.error(`xAI API error: ${res.status} ${res.statusText}`);
      return { trends: [], unavailable: false };
    }

    const data = await res.json();
    const outputMessage = data.output?.find(
      (item: Record<string, unknown>) => item.type === "message",
    );
    const textBlock = outputMessage?.content?.find(
      (block: Record<string, unknown>) => block.type === "text",
    );
    const rawText: string = textBlock?.text ?? "";

    if (!rawText) {
      return { trends: [], unavailable: false };
    }

    return { trends: parseTrends(rawText, topics), unavailable: false };
  } catch (error) {
    console.error("Grok search failed:", error);
    return { trends: [], unavailable: false };
  }
}
