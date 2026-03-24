import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { DashboardBackfillBanner } from "@/components/dashboard/backfill-status-banner";
import {
  TokenExpiryBanner,
  getTokenStatus,
} from "@/components/dashboard/token-expiry-banner";
import {
  getMostRecentBackfillJob,
} from "@/lib/backfill-recovery";
import { ViralRecoveryCard } from "@/components/dashboard/viral-recovery-card";
import {
  getViralRecoveryState,
  type ViralDetectionPost,
  type DailyStat,
} from "@/lib/viral-detection";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;
  const [{ data: user }, backfillJob, postsResult, statsResult] =
    await Promise.all([
      supabase
        .from("users")
        .select("username, token_expires_at")
        .eq("id", userId)
        .single(),
      getMostRecentBackfillJob(supabase, userId),
      supabase.rpc("get_posts_with_metrics" as never, {
        p_user_id: userId,
        p_sort_column: "published_at",
        p_sort_order: "desc",
        p_limit: 10000,
        p_offset: 0,
        p_media_types: null,
        p_date_from: null,
        p_date_to: null,
      } as never) as unknown as Promise<{
        data: Array<{
          id: string;
          text_preview: string | null;
          permalink: string | null;
          published_at: string;
          views: number;
        }> | null;
        error: { message: string } | null;
      }>,
      supabase
        .from("daily_stats")
        .select("date, followers_count")
        .eq("user_id", userId)
        .order("date", { ascending: true }),
    ]);

  if (!user?.username) redirect("/");

  const tokenStatus = user.token_expires_at
    ? getTokenStatus(user.token_expires_at)
    : "valid";

  // Compute viral recovery state (non-critical — gracefully handle errors)
  let viralRecoveryState = null;
  if (postsResult.data && !postsResult.error) {
    const posts: ViralDetectionPost[] = postsResult.data.map((p) => ({
      id: p.id,
      text_preview: p.text_preview,
      permalink: p.permalink,
      published_at: p.published_at,
      views: Number(p.views),
    }));
    const dailyStats: DailyStat[] = (statsResult.data ?? []).map((s) => ({
      date: s.date as string,
      followers_count: s.followers_count as number | null,
    }));
    viralRecoveryState = getViralRecoveryState(
      posts,
      dailyStats,
      new Date().toISOString(),
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader username={user.username} />
      <div className="mx-auto max-w-6xl px-6">
        {tokenStatus !== "valid" && (
          <div className="mb-4">
            <TokenExpiryBanner status={tokenStatus} />
          </div>
        )}
        <DashboardBackfillBanner
          initialJob={backfillJob}
        />
        {viralRecoveryState && (
          <ViralRecoveryCard recoveryState={viralRecoveryState} />
        )}
        <DashboardTabs />
        {children}
      </div>
    </div>
  );
}
