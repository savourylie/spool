import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { PostTable, type PostRow } from "@/components/dashboard/post-table";
import { PostFilters } from "@/components/dashboard/post-filters";
import { FormatAnalysis } from "@/components/dashboard/format-analysis";
import { ReselectionAlert } from "@/components/dashboard/reselection-alert";
import { TimingHeatmap, type TimingPost } from "@/components/dashboard/timing-heatmap";
import { CadenceOptimizer } from "@/components/dashboard/cadence-optimizer";
import { BestTimesClient } from "@/components/dashboard/best-times-client";
import { detectReselectedPosts } from "@/lib/reselection-detection";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";
import {
  POSTS_PAGE_SIZE,
  getPostsTotalPages,
} from "@/lib/posts-pagination";
import { getVelocityMapForRecentPosts } from "@/lib/velocity-scoring";

export const metadata: Metadata = { title: "Performance — Spool" };

const VALID_MEDIA_TYPES = ["TEXT", "IMAGE", "VIDEO", "CAROUSEL"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const VALID_SORT_COLUMNS = [
  "published_at",
  "views",
  "likes",
  "replies",
  "reposts",
  "quotes",
  "shares",
  "engagement_rate",
] as const;

type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

function isValidSort(s: string): s is SortColumn {
  return (VALID_SORT_COLUMNS as readonly string[]).includes(s);
}

export default async function UnderstandPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sortBy: SortColumn = isValidSort(String(params.sort ?? ""))
    ? (String(params.sort) as SortColumn)
    : "published_at";
  const sortOrder = params.order === "asc" ? "asc" : "desc";

  // Parse filter params
  const typesParam = typeof params.types === "string" ? params.types : "";
  const mediaTypes = typesParam
    ? typesParam
        .split(",")
        .filter((t): t is (typeof VALID_MEDIA_TYPES)[number] =>
          (VALID_MEDIA_TYPES as readonly string[]).includes(t)
        )
    : null;
  const p_media_types =
    mediaTypes && mediaTypes.length > 0 && mediaTypes.length < VALID_MEDIA_TYPES.length
      ? mediaTypes
      : null;

  const fromRaw = String(params.from ?? "");
  const toRaw = String(params.to ?? "");
  const p_date_from = DATE_REGEX.test(fromRaw) ? fromRaw : null;
  const p_date_to = DATE_REGEX.test(toRaw) ? toRaw : null;

  const hasFilters = p_media_types !== null || p_date_from !== null || p_date_to !== null;

  const supabase = createAdminClient();
  const userId = session.value;
  const offset = (page - 1) * POSTS_PAGE_SIZE;

  // ── Parallel data fetching ─────────────────────────────────────────
  const [postsResult, allPostsResult, timingResult, backfillJob, reselectedPosts] =
    await Promise.all([
      // Paginated + filtered posts for the table
      supabase.rpc("get_posts_with_metrics" as never, {
        p_user_id: userId,
        p_sort_column: sortBy,
        p_sort_order: sortOrder,
        p_limit: POSTS_PAGE_SIZE,
        p_offset: offset,
        p_media_types: p_media_types,
        p_date_from: p_date_from,
        p_date_to: p_date_to,
      } as never) as unknown as Promise<{
        data: Array<PostRow & { total_count: number }> | null;
        error: { message: string } | null;
      }>,
      // All posts (unfiltered) for format analysis
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
        data: Array<PostRow & { total_count: number }> | null;
        error: { message: string } | null;
      }>,
      // Timing data for sidebar
      supabase.rpc("get_timing_heatmap_data" as never, {
        p_user_id: userId,
      } as never) as unknown as Promise<{
        data: TimingPost[] | null;
        error: { message: string } | null;
      }>,
      getMostRecentBackfillJob(supabase, userId),
      detectReselectedPosts(supabase, userId),
    ]);

  const { data: rows, error: postsError } = postsResult;
  const { data: timingData, error: timingError } = timingResult;

  if (postsError || !rows) {
    return <ErrorState description="We couldn't load your posts right now." />;
  }

  if (timingError || !timingData) {
    return <ErrorState description="We couldn't load your timing data right now." />;
  }

  // ── Normalize data ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const posts: PostRow[] = rows.map(({ total_count, ...rest }) => rest);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const allPosts: PostRow[] = (allPostsResult.data ?? []).map(({ total_count, ...rest }) => rest);
  const timingPosts: TimingPost[] = timingData;

  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = getPostsTotalPages(totalCount);
  const isImporting = isImportingBackfillStatus(backfillJob?.status);

  // Velocity badges (non-critical)
  let velocityMap: Record<string, { score: "green" | "yellow" | "red"; velocity: number; average: number }> = {};
  try {
    velocityMap = await getVelocityMapForRecentPosts(userId, posts, new Date().toISOString());
  } catch {
    // Non-critical feature
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="py-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-3xl font-bold">Performance</h1>
        <ConfidenceBadge sample={totalCount} />
      </div>
      <p className="mt-2 text-muted-foreground">
        Understand how your content performs across formats and timing.
      </p>

      {/* 2-column grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        {/* Left column: posts */}
        <div>
          <PostFilters />
          <ReselectionAlert posts={reselectedPosts} />
          <PostTable
            posts={posts}
            currentPage={page}
            totalCount={totalCount}
            totalPages={totalPages}
            sortBy={sortBy}
            sortOrder={sortOrder}
            hasFilters={hasFilters}
            isImporting={isImporting}
            velocityMap={velocityMap}
          />
        </div>

        {/* Right column: timing sidebar */}
        <div className="hidden xl:block">
          <div className="sticky top-4 space-y-6">
            <TimingHeatmap posts={timingPosts} isImporting={isImporting} compact />
            <BestTimesClient posts={timingPosts} />
            <CadenceOptimizer posts={timingPosts} isImporting={isImporting} compact />
          </div>
        </div>
      </div>

      {/* Full-width: format analysis */}
      <div className="mt-8">
        <FormatAnalysis posts={allPosts} isImporting={isImporting} />
      </div>
    </div>
  );
}
