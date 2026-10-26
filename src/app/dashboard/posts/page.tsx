import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";

import { ErrorState } from "@/components/ui/error-state";
import { buttonVariants } from "@/components/ui/button-variants";
import { LibraryTabs } from "@/components/dashboard/library-tabs";
import { isLibraryTab, type LibraryTab } from "@/lib/library-tabs";
import { PostFilters } from "@/components/dashboard/post-filters";
import { PostSyncButton } from "@/components/dashboard/post-sync-button";
import { PostsLibrary } from "@/components/dashboard/posts-library";
import { RepliesLibrary, type ReplyLibraryRow } from "@/components/dashboard/replies-library";
import { ReplySyncButton } from "@/components/dashboard/reply-sync-button";
import { RepostsLibrary, type RepostLibraryRow } from "@/components/dashboard/reposts-library";
import { ReselectionAlert } from "@/components/dashboard/reselection-alert";
import { ScreenHead } from "@/components/dashboard/screen-head";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";
import { parseOverview } from "@/lib/posts-overview";
import {
  POSTS_PAGE_SIZE,
  getPostsTotalPages,
} from "@/lib/posts-pagination";
import type { PostRow } from "@/lib/post-row";
import { detectReselectedPosts } from "@/lib/reselection-detection";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/server";
import { getVelocityMapForRecentPosts } from "@/lib/velocity-scoring";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const metadata: Metadata = { title: "Library — Spool" };

const VALID_MEDIA_TYPES = ["TEXT", "IMAGE", "VIDEO", "CAROUSEL"] as const;
const MEDIA_POST_TYPES = ["IMAGE", "VIDEO", "CAROUSEL"];
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

function isValidSort(value: string): value is SortColumn {
  return (VALID_SORT_COLUMNS as readonly string[]).includes(value);
}

function getString(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
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
  const tabParam = getString(params, "tab");
  const tab: LibraryTab = isLibraryTab(tabParam) ? tabParam : "posts";
  const page = Math.max(1, Number(params.page) || 1);
  const sortBy: SortColumn = isValidSort(getString(params, "sort"))
    ? (getString(params, "sort") as SortColumn)
    : "published_at";
  const sortOrder: "asc" | "desc" =
    params.order === "asc" ? "asc" : "desc";

  const typesParam = getString(params, "types");
  const mediaTypes = typesParam
    ? typesParam
        .split(",")
        .filter((type): type is (typeof VALID_MEDIA_TYPES)[number] =>
          (VALID_MEDIA_TYPES as readonly string[]).includes(type),
        )
    : null;
  const pMediaTypes =
    tab !== "media" &&
    mediaTypes &&
    mediaTypes.length > 0 &&
    mediaTypes.length < VALID_MEDIA_TYPES.length
      ? mediaTypes
      : null;

  const fromRaw = getString(params, "from");
  const toRaw = getString(params, "to");
  const pDateFrom = DATE_REGEX.test(fromRaw) ? fromRaw : null;
  const pDateTo = DATE_REGEX.test(toRaw) ? toRaw : null;

  const hasFilters =
    tab === "media"
      ? pDateFrom !== null || pDateTo !== null
      : pMediaTypes !== null || pDateFrom !== null || pDateTo !== null;

  const selectedPostId =
    tab === "posts" || tab === "media" ? getString(params, "post") || null : null;
  const selectedReplyId =
    tab === "replies" ? getString(params, "reply") || null : null;
  const selectedRepostId =
    tab === "reposts" ? getString(params, "repost") || null : null;

  const supabase = createAdminClient();
  const userId = session.value;
  const offset = (page - 1) * POSTS_PAGE_SIZE;

  const [
    postCountResult,
    mediaCountResult,
    replyCountResult,
    repostCountResult,
    backfillJob,
    userResult,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("media_type", MEDIA_POST_TYPES),
    supabase
      .from("user_replies")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("reposts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    getMostRecentBackfillJob(supabase, userId),
    supabase.from("users").select("username").eq("id", userId).single(),
  ]);

  const username = userResult.data?.username ?? "you";

  const counts: Record<LibraryTab, number> = {
    posts: postCountResult.count ?? 0,
    media: mediaCountResult.count ?? 0,
    replies: replyCountResult.count ?? 0,
    reposts: repostCountResult.count ?? 0,
  };

  const isImporting = isImportingBackfillStatus(backfillJob?.status);

  let posts: PostRow[] = [];
  let replies: ReplyLibraryRow[] = [];
  let reposts: RepostLibraryRow[] = [];
  let totalCount = 0;
  let overview = null;
  let velocityMap: Awaited<ReturnType<typeof getVelocityMapForRecentPosts>> = {};
  let reselectedPosts: Awaited<ReturnType<typeof detectReselectedPosts>> = [];

  if (tab === "posts" || tab === "media") {
    const [postsResult, overviewResult, reselected] = await Promise.all([
      supabase.rpc("get_posts_with_metrics" as never, {
        p_user_id: userId,
        p_sort_column: sortBy,
        p_sort_order: sortOrder,
        p_limit: POSTS_PAGE_SIZE,
        p_offset: offset,
        p_media_types: pMediaTypes,
        p_date_from: pDateFrom,
        p_date_to: pDateTo,
        p_only_media: tab === "media",
      } as never) as unknown as Promise<{
        data: Array<PostRow & { total_count: number }> | null;
        error: { message: string } | null;
      }>,
      supabase.rpc("get_posts_overview" as never, {
        p_user_id: userId,
      } as never) as unknown as Promise<{
        data:
          | Array<{
              total_posts: number;
              total_views: number;
              total_interactions: number;
              engagement_rate: number;
              media_breakdown: Json;
              top_post: Json;
            }>
          | null;
        error: { message: string } | null;
      }>,
      tab === "posts"
        ? detectReselectedPosts(supabase, userId)
        : Promise.resolve([]),
    ]);

    if (postsResult.error || !postsResult.data) {
      return (
        <ErrorState description="We couldn't load your posts right now." />
      );
    }

    const rows = postsResult.data;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    posts = rows.map(({ total_count, ...rest }) => rest as PostRow);
    totalCount = rows[0]?.total_count ?? 0;
    overview = parseOverview(overviewResult.data?.[0] ?? null);
    reselectedPosts = reselected;

    try {
      velocityMap = await getVelocityMapForRecentPosts(
        userId,
        posts,
        new Date().toISOString(),
      );
    } catch {
      // Non-critical signal.
    }
  }

  if (tab === "replies") {
    const { data, count, error } = await supabase
      .from("user_replies")
      .select(
        "id, text, permalink, replied_at, risk_level, risk_categories, risk_summary, review_status, media_type, media_url, thumbnail_url, alt_text, link_attachment_url, shortcode",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("replied_at", { ascending: false })
      .range(offset, offset + POSTS_PAGE_SIZE - 1);

    if (error) {
      return (
        <ErrorState description="We couldn't load your replies right now." />
      );
    }

    replies = (data ?? []) as ReplyLibraryRow[];
    totalCount = count ?? 0;
  }

  if (tab === "reposts") {
    const { data, count, error } = await supabase
      .from("reposts")
      .select("id, permalink, shortcode, reposted_at", { count: "exact" })
      .eq("user_id", userId)
      .order("reposted_at", { ascending: false })
      .range(offset, offset + POSTS_PAGE_SIZE - 1);

    if (error) {
      return (
        <ErrorState description="We couldn't load your reposts right now." />
      );
    }

    reposts = (data ?? []) as RepostLibraryRow[];
    totalCount = count ?? 0;
  }

  const totalPages = getPostsTotalPages(totalCount);
  const listKey = [
    tab,
    page,
    sortBy,
    sortOrder,
    pMediaTypes?.join(",") ?? "",
    pDateFrom ?? "",
    pDateTo ?? "",
  ].join("|");

  return (
    <div className="py-8">
      <ScreenHead
        eyebrow="All · your library"
        title="Library"
        actions={
          <>
            {tab === "replies" ? <ReplySyncButton /> : <PostSyncButton />}
            {tab === "posts" || tab === "media" ? (
              <a
                href="/api/export/posts"
                download
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <DownloadSimple weight="bold" className="size-3.5" />
                Export CSV
              </a>
            ) : null}
          </>
        }
      >
        Every post, reply, image and repost — one archive.
      </ScreenHead>

      <LibraryTabs counts={counts} activeTab={tab} />

      {tab === "posts" ? (
        <div className="mt-4">
          <PostFilters />
        </div>
      ) : null}

      {tab === "media" ? (
        <div className="mt-4">
          <PostFilters showMediaTypes={false} />
        </div>
      ) : null}

      {tab === "posts" && reselectedPosts.length > 0 ? (
        <div className="mt-4">
          <ReselectionAlert posts={reselectedPosts} />
        </div>
      ) : null}

      {tab === "posts" || tab === "media" ? (
        <PostsLibrary
          posts={posts}
          username={username}
          currentPage={page}
          totalCount={totalCount}
          totalPages={totalPages}
          sortBy={sortBy}
          sortOrder={sortOrder}
          hasFilters={hasFilters}
          isImporting={isImporting}
          velocityMap={velocityMap}
          overview={overview}
          initialSelectedId={selectedPostId}
          listKey={listKey}
          mode={tab === "media" ? "grid" : "list"}
        />
      ) : null}

      {tab === "replies" ? (
        <RepliesLibrary
          replies={replies}
          currentPage={page}
          totalCount={totalCount}
          totalPages={totalPages}
          hasFilters={false}
          initialSelectedId={selectedReplyId}
          listKey={`${tab}|${page}`}
        />
      ) : null}

      {tab === "reposts" ? (
        <RepostsLibrary
          reposts={reposts}
          currentPage={page}
          totalCount={totalCount}
          totalPages={totalPages}
          initialSelectedId={selectedRepostId}
          listKey={`${tab}|${page}`}
        />
      ) : null}
    </div>
  );
}
