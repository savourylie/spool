import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BrandVoicePanel } from "@/components/dashboard/brand-voice-panel";
import { ErrorState } from "@/components/ui/error-state";
import {
  type BrandVoiceProfile,
  type BrandVoiceRecord,
} from "@/lib/brand-voice-types";
import type { ConfidenceTier } from "@/lib/data-confidence";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Voice — Spool" };

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const userId = session.value;
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("brand_voice_profiles")
    .select("profile, source_post_count, confidence_tier, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return <ErrorState description="We couldn't load your voice profile." />;
  }

  let record: BrandVoiceRecord | null = null;
  const postPermalinkMap: Record<string, string | null> = {};

  if (row) {
    const profile = row.profile as unknown as BrandVoiceProfile;
    record = {
      profile,
      sourcePostCount: row.source_post_count,
      confidenceTier: row.confidence_tier as ConfidenceTier,
      updatedAt: row.updated_at,
    };

    const postIds = new Set<string>();
    for (const entry of Object.values(profile)) {
      for (const ev of entry?.evidence ?? []) {
        if (ev?.postId) postIds.add(ev.postId);
      }
    }

    if (postIds.size > 0) {
      const { data: posts } = await supabase
        .from("posts")
        .select("id, permalink")
        .eq("user_id", userId)
        .in("id", Array.from(postIds));

      for (const post of posts ?? []) {
        postPermalinkMap[post.id] = post.permalink;
      }
    }
  }

  return (
    <BrandVoicePanel record={record} postPermalinkMap={postPermalinkMap} />
  );
}
