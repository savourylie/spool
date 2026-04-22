import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { detectReselectedPosts } from "@/lib/reselection-detection";
import { getViralRecoveryState } from "@/lib/viral-detection";
import type { DailyStat } from "@/lib/viral-detection";
import { computeFormatBreakdown } from "@/lib/format-analysis";
import type { PostRow } from "@/components/dashboard/post-table";
import {
  findBestPost,
  computeNextBestSlot,
  computeMiniHeatmap,
  deriveCadenceStatus,
  computeVelocityTrend,
  generateWhyFactors,
} from "@/lib/today-hub-helpers";
import { WhatToPostCard } from "@/components/dashboard/what-to-post-card";
import { WhenToPostCard } from "@/components/dashboard/when-to-post-card";
import { PulseCard } from "@/components/dashboard/pulse-card";
import {
  BestPostCard,
  type BestPostData,
} from "@/components/dashboard/best-post-card";
import { ReselectionAlert } from "@/components/dashboard/reselection-alert";
import { ViralRecoveryCard } from "@/components/dashboard/viral-recovery-card";

export const metadata: Metadata = { title: "Today — Spool" };

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const userId = session.value;
  const supabase = createAdminClient();

  // ── Parallel data fetching ─────────────────────────────────────────
  const [postsResult, dailyStatsResult, backfillJob, reselectedPosts, userResult] =
    await Promise.all([
      supabase.rpc("get_posts_with_metrics", {
        p_user_id: userId,
        p_sort_column: "views",
        p_sort_order: "desc",
        p_limit: 50,
        p_offset: 0,
      }),
      supabase
        .from("daily_stats")
        .select("date, followers_count")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(14),
      getMostRecentBackfillJob(supabase, userId),
      detectReselectedPosts(supabase, userId),
      supabase.from("users").select("username").eq("id", userId).single(),
    ]);

  // ── Normalize data ─────────────────────────────────────────────────
  const posts: PostRow[] = (postsResult.data ?? []).map((row) => ({
    id: row.id,
    media_type: row.media_type,
    text_preview: row.text_preview,
    permalink: row.permalink,
    published_at: row.published_at,
    views: Number(row.views),
    likes: Number(row.likes),
    replies: Number(row.replies),
    reposts: Number(row.reposts),
    quotes: Number(row.quotes),
    shares: Number(row.shares),
    engagement_rate: Number(row.engagement_rate),
  }));

  const dailyStats = dailyStatsResult.data ?? [];
  const isImporting = isImportingBackfillStatus(backfillJob?.status);
  const username = userResult.data?.username ?? "there";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();

  // ── WhenToPostCard data ────────────────────────────────────────────
  const bestSlot = posts.length > 0 ? computeNextBestSlot(posts, timezone) : null;
  const heatmapData = posts.length > 0 ? computeMiniHeatmap(posts, timezone) : [];
  const lastPost = posts.length > 0
    ? posts.reduce((latest, p) =>
        new Date(p.published_at) > new Date(latest.published_at) ? p : latest,
      )
    : null;
  const cadenceResult = deriveCadenceStatus(lastPost?.published_at ?? null, now);

  // ── PulseCard data ─────────────────────────────────────────────────
  const latestFollowers = dailyStats[0]?.followers_count ?? 0;
  const weekAgoEntry = dailyStats.find((_, i) => i >= 7) ?? dailyStats[dailyStats.length - 1];
  const weekAgoFollowers = weekAgoEntry?.followers_count ?? 0;
  const followersDelta = (latestFollowers ?? 0) - (weekAgoFollowers ?? 0);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const recentPosts = posts.filter((p) => p.published_at >= sevenDaysAgo);
  const lastWeekPosts = posts.filter(
    (p) => p.published_at >= fourteenDaysAgo && p.published_at < sevenDaysAgo,
  );

  const postCount = recentPosts.length;
  const avgEngagementRate =
    recentPosts.length > 0
      ? recentPosts.reduce((sum, p) => sum + p.engagement_rate, 0) / recentPosts.length
      : 0;

  const thisWeekAvg = avgEngagementRate;
  const lastWeekAvg =
    lastWeekPosts.length > 0
      ? lastWeekPosts.reduce((sum, p) => sum + p.engagement_rate, 0) / lastWeekPosts.length
      : 0;
  const velocityTrend = computeVelocityTrend(thisWeekAvg, lastWeekAvg);

  // ── BestPostCard data ──────────────────────────────────────────────
  const bestPost = findBestPost(recentPosts);
  const formatBreakdown = computeFormatBreakdown(posts);
  const bestSlots = bestSlot ? [{ day: bestSlot.day, hour: bestSlot.hour }] : [];
  const whyFactors = bestPost
    ? generateWhyFactors(bestPost, bestSlots, formatBreakdown, timezone)
    : [];

  const bestPostData: BestPostData | null = bestPost
    ? {
        textPreview: bestPost.text_preview,
        permalink: bestPost.permalink,
        views: bestPost.views,
        likes: bestPost.likes,
        replies: bestPost.replies,
        mediaType: bestPost.media_type,
        publishedAt: bestPost.published_at,
        whyFactors,
      }
    : null;

  // ── Viral recovery ─────────────────────────────────────────────────
  const viralDailyStats: DailyStat[] = dailyStats.map((s) => ({
    date: s.date,
    followers_count: s.followers_count,
  }));
  const recoveryState = getViralRecoveryState(posts, viralDailyStats, now.toISOString());

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="py-8">
      <h1 className="font-heading text-3xl font-bold">
        Welcome back, {username}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Here&apos;s what to focus on today.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WhatToPostCard isImporting={isImporting} />
        <WhenToPostCard
          bestSlot={bestSlot}
          heatmapData={heatmapData}
          cadenceStatus={cadenceResult.status}
          lastPostHoursAgo={cadenceResult.hoursAgo}
          isImporting={isImporting}
        />
        <PulseCard
          followersDelta={followersDelta}
          postCount={postCount}
          avgEngagementRate={avgEngagementRate}
          velocityTrend={velocityTrend}
          isImporting={isImporting}
        />
        <BestPostCard
          post={bestPostData}
          sampleSize={recentPosts.length}
          isImporting={isImporting}
        />
      </div>

      {(reselectedPosts.length > 0 || recoveryState) && (
        <div className="mt-6">
          {reselectedPosts.length > 0 && (
            <ReselectionAlert posts={reselectedPosts} />
          )}
          {recoveryState && (
            <ViralRecoveryCard recoveryState={recoveryState} />
          )}
        </div>
      )}
    </div>
  );
}
