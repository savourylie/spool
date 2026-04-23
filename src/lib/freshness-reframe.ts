// Reframe helper for yellow-external freshness verdicts (TICKET-072).
//
// When the freshness gate returns a yellow verdict driven by external
// saturation — but the user hasn't covered the topic in 30+ days — the Today
// Hub surfaces a short "sharper angle" suggestion instead of dropping the
// candidate. This helper does that single LLM call, kept deliberately small:
// ~100 tokens of system prompt + ~80 tokens out, well inside the ticket's
// 500-token guardrail.
//
// Cached per (userId, topic) for 12h via unstable_cache so repeat Today Hub
// visits don't re-burn LLM calls. Returns null on any failure so callers can
// degrade gracefully (drop the yellow candidate rather than render a stale
// reframe).
//
// Server-only: uses resolveLLMClient which touches service-role Supabase.

import { unstable_cache } from "next/cache";

import { resolveLLMClient } from "@/lib/llm-resolver";

export const REFRAME_TIMEOUT_MS = 8_000;
export const REFRAME_MAX_TOKENS = 80;
export const REFRAME_MAX_OUTPUT_LENGTH = 200;
export const REFRAME_CACHE_TTL_SECONDS = 60 * 60 * 12;

const SYSTEM_PROMPT = `You are a content-angle strategist for social creators.

Given a topic that is mildly saturated externally (related trends are active), suggest ONE sharper angle the creator could take to differentiate from the herd. Be concrete: name a specific lens, audience, or tension — never a generic "my take on X".

Return ONLY the angle as a single short sentence, ≤ 80 characters. No preamble, no "Try:", no quotes, no trailing period required.`;

function cleanReframe(raw: string): string | null {
  const trimmed = raw.trim().replace(/^["'`\s]+|["'`\s]+$/g, "");
  if (!trimmed) return null;
  if (trimmed.length > REFRAME_MAX_OUTPUT_LENGTH) return null;
  return trimmed;
}

async function reframeTopicAngleUncached(
  topic: string,
  userId: string,
): Promise<string | null> {
  try {
    const llm = await resolveLLMClient(userId);
    const raw = await llm.generate({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Topic: ${topic}` }],
      maxTokens: REFRAME_MAX_TOKENS,
      timeout: REFRAME_TIMEOUT_MS,
    });
    return cleanReframe(raw);
  } catch {
    return null;
  }
}

export async function reframeTopicAngle(
  topic: string,
  userId: string,
): Promise<string | null> {
  const cached = unstable_cache(
    () => reframeTopicAngleUncached(topic, userId),
    ["freshness-reframe", userId, topic],
    { revalidate: REFRAME_CACHE_TTL_SECONDS },
  );
  return cached();
}

export const __testOnly = {
  cleanReframe,
  reframeTopicAngleUncached,
  SYSTEM_PROMPT,
};
