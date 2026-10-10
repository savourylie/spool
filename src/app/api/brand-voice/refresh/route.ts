import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { LLMAuthError } from "@/lib/llm-client";
import {
  analyzeBrandVoice,
  BrandVoiceValidationError,
} from "@/lib/brand-voice";

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit via the updated_at column on the last profile.
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("brand_voice_profiles")
    .select("updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.updated_at) {
    const ageMs = Date.now() - new Date(existing.updated_at).getTime();
    if (ageMs < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - ageMs) / 1000);
      return NextResponse.json(
        { error: "Rate limit — refresh again in a few minutes", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  try {
    const record = await analyzeBrandVoice(userId);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json(
        { error: "LLM service unavailable" },
        { status: 503 },
      );
    }
    if (error instanceof BrandVoiceValidationError) {
      console.error("Brand voice validation failed:", error.message);
      return NextResponse.json(
        { error: "Invalid LLM output — please retry" },
        { status: 502 },
      );
    }
    console.error("Brand voice refresh failed:", error);
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 },
    );
  }
}
