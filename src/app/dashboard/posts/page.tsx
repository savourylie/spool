import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { ScreenHead } from "@/components/dashboard/screen-head";
import { PostTable, type PostRow } from "@/components/dashboard/post-table";
import { PostFilters } from "@/components/dashboard/post-filters";
import { PostSyncButton } from "@/components/dashboard/post-sync-button";
import { ReselectionAlert } from "@/components/dashboard/reselection-alert";
import { detectReselectedPosts } from "@/lib/reselection-detection";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";
import {
  POSTS_PAGE_SIZE,
  getPostsTotalPages,
} from "@/lib/posts-pagination";
import { getVelocityMapForRecentPosts } from "@/lib/velocity-scoring";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { buttonVariants } from "@/components/ui/button-variants";

export const metadata: Metadata = { title: "Posts — Spool" };

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

export default async function PostsPage({
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

  const typesParam = typeof params.types === "string" ? params.types : "";
  const mediaTypes = typesParam
    ? typesParam
        .split(",")
        .filter((t): t is (typeof VALID_MEDIA_TYPES)[number] =>
          (VALID_MEDIA_TYPES as readonly string[]).includes(t),
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

  const hasFilters =
    p_media_types !== null || p_date_from !== null || p_date_to !== null;

  const supabase = createAdminClient();
  const userId = session.value;
  const offset = (page - 1) * POSTS_PAGE_SIZE;

  const [postsResult, backfillJob, reselectedPosts] = await Promise.all([
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
    getMostRecentBackfillJob(supabase, userId),
    detectReselectedPosts(supabase, userId),
  ]);

  const { data: rows, error: postsError } = postsResult;

  if (postsError || !rows) {
    return <ErrorState description="We couldn't load your posts right now." />;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const posts: PostRow[] = rows.map(({ total_count, ...rest }) => rest);
  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = getPostsTotalPages(totalCount);
  const isImporting = isImportingBackfillStatus(backfillJob?.status);

  let velocityMap: Record<
    string,
    { score: "green" | "yellow" | "red"; velocity: number; average: number }
  > = {};
  try {
    velocityMap = await getVelocityMapForRecentPosts(
      userId,
      posts,
      new Date().toISOString(),
    );
  } catch {
    // Non-critical feature
  }

  return (
    <div className="py-8">
      <ScreenHead
        eyebrow="All · your library"
        title={
          <span className="flex items-center gap-3">
            {totalCount.toLocaleString()} posts
            <ConfidenceBadge sample={totalCount} compact />
          </span>
        }
        actions={
          <>
            <PostSyncButton />
            <a
              href="/api/export/posts"
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <DownloadSimple weight="bold" className="size-3.5" />
              Export CSV
            </a>
          </>
        }
      />

      <div className="mt-6">
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
    </div>
  );
}
