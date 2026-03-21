import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  StickerCard,
  StickerCardContent,
} from "@/components/ui/card";
import {
  FollowerChart,
  type DailyStatRow,
  type PostSummary,
} from "@/components/dashboard/follower-chart";
import {
  DemographicsCharts,
  type DemographicRow,
} from "@/components/dashboard/demographics-charts";

export default async function AudiencePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  const [statsResult, postsResult, demographicsResult] = await Promise.all([
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
  ]);

  if (statsResult.error) {
    return (
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardContent>
          <p className="text-destructive">
            Failed to load audience data: {statsResult.error.message}
          </p>
        </StickerCardContent>
      </StickerCard>
    );
  }

  // Get the latest followers_count from daily_stats
  const dailyStats = (statsResult.data ?? []) as DailyStatRow[];
  const latestStat = dailyStats.length > 0 ? dailyStats[dailyStats.length - 1] : null;
  const followersCount = latestStat?.followers_count ?? null;

  return (
    <>
      <FollowerChart
        dailyStats={dailyStats}
        posts={(postsResult.data ?? []) as PostSummary[]}
      />
      <DemographicsCharts
        demographics={(demographicsResult.data ?? []) as DemographicRow[]}
        followersCount={followersCount}
      />
    </>
  );
}
