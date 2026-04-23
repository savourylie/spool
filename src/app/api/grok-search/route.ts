import { type NextRequest, NextResponse } from "next/server";

import { searchTrends } from "@/lib/grok-search";
import { getSession } from "@/lib/session";

export type { TrendingTopic } from "@/lib/grok-search";

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { trends } = await searchTrends(body.topics as string[]);
  return NextResponse.json({ trends });
}
