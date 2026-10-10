import { type NextRequest, NextResponse } from "next/server";

import { LLMAuthError } from "@/lib/llm-client";
import { getSession } from "@/lib/session";
import { syncUserReplies } from "@/lib/user-replies-sync";

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncUserReplies(userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json(
        { error: "LLM service unavailable" },
        { status: 503 },
      );
    }

    console.error("Replies sync failed:", error);
    return NextResponse.json(
      { error: "Failed to sync replies" },
      { status: 500 },
    );
  }
}
