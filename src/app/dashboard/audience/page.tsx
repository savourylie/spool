import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import {
  FollowerChart,
  type DailyStatRow,
  type PostSummary,
} from "@/components/dashboard/follower-chart";
import {
  DemographicsCharts,
  type DemographicRow,
} from "@/components/dashboard/demographics-charts";
import { SemanticFocus } from "@/components/dashboard/semantic-focus";
import type { SemanticFocusPost } from "@/lib/semantic-focus";
import {
  isImportingBackfillStatus,
} from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";

export default async function AudiencePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  const [statsResult, postsResult, demographicsResult, backfillResult, focusPostsResult] = await Promise.all([
    supabase
      .from("daily_stats")
      .select("date, followers_count")
      .eq("user_id", userId)
      .order("date", { ascending: true }),
    supabase
      .from("posts")
      .select("id, text_preview, permalink, published_at")
      .eq("user_id", userId)
      .order("published_at", { ascending: true }),
    supabase
      .from("demographics")
      .select("dimension, key, value, fetched_at")
      .eq("user_id", userId),
    getMostRecentBackfillJob(supabase, userId),
    supabase
      .from("posts")
      .select("topic_tag, text_full, published_at")
      .eq("user_id", userId)
      .order("published_at", { ascending: true }),
  ]);

  if (statsResult.error) {
    return <ErrorState description="We couldn't load your audience data right now." />;
  }

  // Get the latest followers_count from daily_stats
  const dailyStats = (statsResult.data ?? []) as DailyStatRow[];
  const latestStat = dailyStats.length > 0 ? dailyStats[dailyStats.length - 1] : null;
  const followersCount = latestStat?.followers_count ?? null;
  const isImporting = isImportingBackfillStatus(backfillResult?.status);

  return (
    <>
      <FollowerChart
        dailyStats={dailyStats}
        posts={(postsResult.data ?? []) as PostSummary[]}
        isImporting={isImporting}
      />
      <DemographicsCharts
        demographics={(demographicsResult.data ?? []) as DemographicRow[]}
        followersCount={followersCount}
        isImporting={isImporting}
      />
      <SemanticFocus
        posts={(focusPostsResult.data ?? []) as SemanticFocusPost[]}
        isImporting={isImporting}
      />
    </>
  );
}
