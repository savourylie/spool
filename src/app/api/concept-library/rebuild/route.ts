import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { extractForUser, ConceptExtractionError } from "@/lib/concept-library";
import { LLMAuthError } from "@/lib/llm-client";

const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const BATCH_SIZE = 20;
const MAX_ITERATIONS = 50; // 50 * 20 = 1000 posts/call ceiling

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const userId =
    body && typeof body === "object" && "user_id" in body
      ? (body as { user_id?: unknown }).user_id
      : undefined;

  if (typeof userId !== "string" || userId.length === 0) {
    return NextResponse.json(
      { error: "user_id required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Rate limit: most recent concept_extracted_at across this user's posts.
  const { data: recent, error: rateError } = await supabase
    .from("posts")
    .select("concept_extracted_at")
    .eq("user_id", userId)
    .not("concept_extracted_at", "is", null)
    .order("concept_extracted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rateError) {
    console.error("Concept library rebuild — rate-limit lookup failed:", rateError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  if (recent?.concept_extracted_at) {
    const ageMs = Date.now() - new Date(recent.concept_extracted_at).getTime();
    if (ageMs < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - ageMs) / 1000);
      return NextResponse.json(
        { error: "Rate limit — try again later", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  try {
    let totalProcessed = 0;
    let totalSkipped = 0;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { processed, skipped } = await extractForUser(userId, BATCH_SIZE);
      totalProcessed += processed;
      totalSkipped += skipped;
      if (processed === 0) break;
    }
    return NextResponse.json({
      processed: totalProcessed,
      skipped: totalSkipped,
    });
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json(
        { error: "LLM service unavailable" },
        { status: 503 },
      );
    }
    if (error instanceof ConceptExtractionError) {
      console.error("Concept extraction validation failed:", error.message);
      return NextResponse.json(
        { error: "Invalid LLM output" },
        { status: 502 },
      );
    }
    console.error("Concept library rebuild failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
