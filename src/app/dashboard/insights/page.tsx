import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { TopicModelViz } from "@/components/dashboard/topic-model-viz";
import { TopicPerformance } from "@/components/dashboard/topic-performance";
import { SemanticFocus } from "@/components/dashboard/semantic-focus";
import { AudienceTopicFit } from "@/components/dashboard/audience-topic-fit";
import { buildTopicModel, type TopicModelPost } from "@/lib/topic-model";
import type { SemanticFocusPost } from "@/lib/semantic-focus";
import type { DemographicSnapshot } from "@/lib/audience-fit";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import {
  isImportingBackfillStatus,
} from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";

const MIN_POSTS_FOR_INSIGHTS = 5;

export default async function InsightsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  // ── Parallel data fetching ──────────────────────────────────────────
  const [postsResult, focusPostsResult, demographicsResult, backfillResult] =
    await Promise.all([
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
        data: TopicModelPost[] | null;
        error: { message: string } | null;
      }>,
      supabase
        .from("posts")
        .select("topic_tag, text_full, published_at")
        .eq("user_id", userId)
        .order("published_at", { ascending: true }),
      supabase
        .from("demographics")
        .select("dimension, key, value, fetched_at")
        .eq("user_id", userId),
      getMostRecentBackfillJob(supabase, userId),
    ]);

  if (postsResult.error) {
    return <ErrorState description="We couldn't load your insights data right now." />;
  }

  // ── Normalize data ──────────────────────────────────────────────────
  const posts = (postsResult.data ?? []) as TopicModelPost[];
  const focusPosts = (focusPostsResult.data ?? []) as SemanticFocusPost[];
  const demographics = (demographicsResult.data ?? []) as DemographicSnapshot[];
  const isImporting = isImportingBackfillStatus(backfillResult?.status);

  // ── Build topic model server-side ───────────────────────────────────
  const topicModel = buildTopicModel(posts);

  // ── Empty state ─────────────────────────────────────────────────────
  if (topicModel.totalPosts < MIN_POSTS_FOR_INSIGHTS) {
    return (
      <div className="py-8">
        <h1 className="font-heading text-3xl font-bold">Topics &amp; Patterns</h1>
        <p className="mt-2 text-muted-foreground">
          Discover content themes and how they perform with your audience.
        </p>
        <div className="mt-12">
          <EmptyState
            icon={<Lightbulb weight="bold" className="size-7" />}
            iconColor="primary"
            title="Not enough data yet"
            description="We need at least 5 posts to build your topic model. Keep posting and check back soon!"
          />
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="py-8">
      <h1 className="font-heading text-3xl font-bold">Topics &amp; Patterns</h1>
      <p className="mt-2 text-muted-foreground">
        Discover content themes and how they perform with your audience.
      </p>

      {/* Top section: full-width treemap */}
      <div className="mt-8">
        <TopicModelViz
          clusters={topicModel.clusters}
          totalPosts={topicModel.totalPosts}
        />
      </div>

      {/* Middle section: 2-column grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopicPerformance clusters={topicModel.clusters} />
        <SemanticFocus posts={focusPosts} isImporting={isImporting} bare />
      </div>

      {/* Bottom section: full-width audience-topic fit */}
      <div className="mt-6">
        <AudienceTopicFit
          clusters={topicModel.clusters}
          demographics={demographics}
          totalPosts={topicModel.totalPosts}
        />
      </div>
    </div>
  );
}
