import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
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
  AudienceFit,
  type DemographicHistoryRow,
  type PostMetricRow,
} from "@/components/dashboard/audience-fit";
import { Crosshair } from "@phosphor-icons/react/dist/ssr/Crosshair";
import { UsersFour } from "@phosphor-icons/react/dist/ssr/UsersFour";
import {
  isImportingBackfillStatus,
} from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";
import {
  computeSemanticFocusData,
  getScoreLevel,
  MIN_POSTS_FOR_FOCUS,
} from "@/lib/semantic-focus";
import {
  computeAudienceAlignmentScore,
  MIN_SNAPSHOTS_FOR_ANALYSIS,
  type EngagementWindow,
} from "@/lib/audience-fit";

export const metadata: Metadata = { title: "Audience — Spool" };

// ---------------------------------------------------------------------------
// Score label maps (mirror component-level configs)
// ---------------------------------------------------------------------------

const FOCUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: "Focused", bg: "bg-quaternary/20", text: "text-quaternary" },
  medium: { label: "Mixed", bg: "bg-tertiary/20", text: "text-tertiary" },
  low: { label: "Scattered", bg: "bg-destructive/20", text: "text-destructive" },
};

const FIT_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  good: { label: "Good Fit", bg: "bg-quaternary/20", text: "text-quaternary" },
  moderate: { label: "Moderate", bg: "bg-tertiary/20", text: "text-tertiary" },
  severe: { label: "Poor Fit", bg: "bg-destructive/20", text: "text-destructive" },
};

// ---------------------------------------------------------------------------
// Summary badge component
// ---------------------------------------------------------------------------

function SummaryBadge({ score, label, bg, textColor }: {
  score: number;
  label: string;
  bg: string;
  textColor: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg} ${textColor}`}>
      {score} &middot; {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function UnderstandAudiencePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  // ── Parallel data fetching (7 queries) ─────────────────────────────
  const [
    statsResult,
    postsResult,
    demographicsResult,
    backfillResult,
    focusPostsResult,
    demoHistoryResult,
    postMetricsResult,
  ] = await Promise.all([
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
    supabase
      .from("demographics_history" as never)
      .select("dimension, key, value, fetched_at" as never)
      .eq("user_id" as never, userId as never)
      .order("fetched_at" as never, { ascending: true } as never) as unknown as Promise<{
        data: DemographicHistoryRow[] | null;
        error: { message: string } | null;
      }>,
    supabase.rpc("get_posts_with_metrics" as never, {
      p_user_id: userId,
      p_sort_column: "published_at",
      p_sort_order: "asc",
      p_limit: 10000,
      p_offset: 0,
      p_media_types: null,
      p_date_from: null,
      p_date_to: null,
    } as never) as unknown as Promise<{
      data: PostMetricRow[] | null;
      error: { message: string } | null;
    }>,
  ]);

  if (statsResult.error) {
    return <ErrorState description="We couldn't load your audience data right now." />;
  }

  // ── Normalize data ─────────────────────────────────────────────────
  const dailyStats = (statsResult.data ?? []) as DailyStatRow[];
  const latestStat = dailyStats.length > 0 ? dailyStats[dailyStats.length - 1] : null;
  const followersCount = latestStat?.followers_count ?? null;
  const isImporting = isImportingBackfillStatus(backfillResult?.status);

  const focusPosts = (focusPostsResult.data ?? []) as SemanticFocusPost[];
  const demoHistory = (demoHistoryResult.data ?? []) as DemographicHistoryRow[];
  const postMetrics = (postMetricsResult.data ?? []) as PostMetricRow[];

  // ── Summary scores for collapsed headers ───────────────────────────
  // Compute plain data in try blocks; construct JSX outside to satisfy
  // the react-hooks/error-boundaries lint rule.
  let focusSummaryData: { score: number; label: string; bg: string; text: string } | null = null;
  try {
    if (focusPosts.length >= MIN_POSTS_FOR_FOCUS) {
      const data = computeSemanticFocusData(focusPosts);
      if (data.currentScore > 0) {
        const level = getScoreLevel(data.currentScore);
        const config = FOCUS_LABELS[level];
        focusSummaryData = {
          score: Math.round(data.currentScore),
          label: config.label,
          bg: config.bg,
          text: config.text,
        };
      }
    }
  } catch {
    // Non-critical — header will just omit the summary badge
  }

  let fitSummaryData: { score: number; label: string; bg: string; text: string } | null = null;
  try {
    const uniqueDates = new Set(demoHistory.map((r) => r.fetched_at.split("T")[0]));
    if (uniqueDates.size >= MIN_SNAPSHOTS_FOR_ANALYSIS && postMetrics.length > 1) {
      const sorted = [...postMetrics].sort(
        (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
      );
      const mid = Math.floor(sorted.length / 2);

      const aggregate = (posts: PostMetricRow[], label: string): EngagementWindow => ({
        periodLabel: label,
        totalViews: posts.reduce((s, p) => s + Number(p.views), 0),
        totalLikes: posts.reduce((s, p) => s + Number(p.likes), 0),
        totalReplies: posts.reduce((s, p) => s + Number(p.replies), 0),
        totalReposts: posts.reduce((s, p) => s + Number(p.reposts), 0),
        totalQuotes: posts.reduce((s, p) => s + Number(p.quotes), 0),
        totalShares: posts.reduce((s, p) => s + Number(p.shares), 0),
        postCount: posts.length,
      });

      const alignment = computeAudienceAlignmentScore(
        aggregate(sorted.slice(0, mid), "Earlier"),
        aggregate(sorted.slice(mid), "Recent"),
      );
      const config = FIT_LABELS[alignment.severity];
      fitSummaryData = {
        score: alignment.score,
        label: config.label,
        bg: config.bg,
        text: config.text,
      };
    }
  } catch {
    // Non-critical
  }

  const focusSummary = focusSummaryData ? (
    <SummaryBadge
      score={focusSummaryData.score}
      label={focusSummaryData.label}
      bg={focusSummaryData.bg}
      textColor={focusSummaryData.text}
    />
  ) : null;

  const fitSummary = fitSummaryData ? (
    <SummaryBadge
      score={fitSummaryData.score}
      label={fitSummaryData.label}
      bg={fitSummaryData.bg}
      textColor={fitSummaryData.text}
    />
  ) : null;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="py-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-3xl font-medium">Audience</h1>
        <ConfidenceBadge sample={focusPosts.length} />
      </div>
      <p className="mt-2 text-muted-foreground">
        Understand who follows you and how well your content fits your audience.
      </p>

      {/* Top section: 2-column grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
      </div>

      {/* Collapsible sections */}
      <div className="mt-8 space-y-8">
        <CollapsibleSection
          title="Semantic Focus"
          description="How concentrated your content is around core topics"
          summary={focusSummary}
          icon={<Crosshair weight="bold" className="size-6" />}
          iconColor="quaternary"
          defaultOpen={false}
        >
          <SemanticFocus
            posts={focusPosts}
            isImporting={isImporting}
            bare
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Audience Fit"
          description="Whether your followers match your content"
          summary={fitSummary}
          icon={<UsersFour weight="bold" className="size-6" />}
          iconColor="secondary"
          defaultOpen={false}
        >
          <AudienceFit
            demographicsHistory={demoHistory}
            postMetrics={postMetrics}
            isImporting={isImporting}
            bare
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}
