import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { LLMAuthError } from "@/lib/llm-client";
import { resolveLLMClient } from "@/lib/llm-resolver";
import {
  buildPredictionRefinementPrompt,
  parsePredictionRefinement,
  applyLLMRefinement,
  type PredictionRange,
} from "@/lib/engagement-prediction";

const MAX_TEXT_LENGTH = 2000;

export async function POST(request: NextRequest): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse & validate body ──────────────────────────────────────
  let body: { text?: string; p25?: number; p50?: number; p75?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Text is required" },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const p25 = Number(body.p25);
  const p50 = Number(body.p50);
  const p75 = Number(body.p75);

  if (
    !Number.isFinite(p25) || p25 < 0 ||
    !Number.isFinite(p50) || p50 < 0 ||
    !Number.isFinite(p75) || p75 < 0
  ) {
    return NextResponse.json(
      { error: "Valid p25, p50, p75 values are required" },
      { status: 400 },
    );
  }

  // ── Fetch follower count ───────────────────────────────────────
  const supabase = createAdminClient();
  const { data: statsRow } = await supabase
    .from("daily_stats")
    .select("followers_count")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const followerCount = statsRow?.followers_count ?? 0;

  // ── Build range for prompt ─────────────────────────────────────
  const range: PredictionRange = {
    p25,
    p50,
    p75,
    matchedCount: 0,
    confidence: "medium",
  };

  // ── Call LLM ───────────────────────────────────────────────────
  try {
    const llm = await resolveLLMClient(userId);
    const { systemPrompt, userMessage } = buildPredictionRefinementPrompt(
      text,
      range,
      followerCount,
    );

    const raw = await llm.generate({
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 256,
    });

    const { multiplier, reasoning } = parsePredictionRefinement(raw);
    const refinement = applyLLMRefinement(range, multiplier, reasoning);

    return NextResponse.json(refinement);
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json(
        { error: "LLM service unavailable" },
        { status: 503 },
      );
    }
    console.error("Prediction refinement failed:", error);
    return NextResponse.json(
      { error: "Prediction refinement failed" },
      { status: 500 },
    );
  }
}
