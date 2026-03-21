import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PostTable, type PostRow } from "@/components/dashboard/post-table";
import { PostFilters } from "@/components/dashboard/post-filters";

const PAGE_SIZE = 20;

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
  const sortBy: SortColumn = isValidSort(String(params.sort ?? "")) ? (String(params.sort) as SortColumn) : "published_at";
  const sortOrder = params.order === "asc" ? "asc" : "desc";

  // Parse filter params
  const typesParam = typeof params.types === "string" ? params.types : "";
  const mediaTypes = typesParam
    ? typesParam.split(",").filter((t): t is (typeof VALID_MEDIA_TYPES)[number] =>
        (VALID_MEDIA_TYPES as readonly string[]).includes(t)
      )
    : null;
  // Null when all types selected (or none specified) — means no filter
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
  const offset = (page - 1) * PAGE_SIZE;

  const { data: rows, error } = await supabase.rpc("get_posts_with_metrics" as never, {
    p_user_id: userId,
    p_sort_column: sortBy,
    p_sort_order: sortOrder,
    p_limit: PAGE_SIZE,
    p_offset: offset,
    p_media_types: p_media_types,
    p_date_from: p_date_from,
    p_date_to: p_date_to,
  } as never) as { data: Array<PostRow & { total_count: number }> | null; error: { message: string } | null };

  if (error || !rows) {
    return <ErrorState description="We couldn't load your posts right now." />;
  }

  const posts: PostRow[] = rows.map(({ total_count: _, ...rest }) => rest);
  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardHeader>
        <StickerCardTitle>Post Performance</StickerCardTitle>
        <StickerCardDescription>
          Sort by any metric to find your best-performing content.
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <PostFilters />
        <PostTable
          posts={posts}
          currentPage={page}
          totalPages={totalPages}
          sortBy={sortBy}
          sortOrder={sortOrder}
          hasFilters={hasFilters}
        />
      </StickerCardContent>
    </StickerCard>
  );
}
