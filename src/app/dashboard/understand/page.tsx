import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { ScreenHead } from "@/components/dashboard/screen-head";
import { type PostRow } from "@/components/dashboard/post-table";
import { FormatAnalysis } from "@/components/dashboard/format-analysis";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";

export const metadata: Metadata = { title: "Performance — Spool" };

export default async function UnderstandPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  // ── Parallel data fetching ─────────────────────────────────────────
  const [allPostsResult, backfillJob] = await Promise.all([
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
    getMostRecentBackfillJob(supabase, userId),
  ]);

  if (allPostsResult.error) {
    return (
      <ErrorState description="We couldn't load your performance data right now." />
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const allPosts: PostRow[] = (allPostsResult.data ?? []).map(({ total_count, ...rest }) => rest);
  const totalCount = allPostsResult.data?.[0]?.total_count ?? allPosts.length;
  const isImporting = isImportingBackfillStatus(backfillJob?.status);

  return (
    <div className="py-8">
      <ScreenHead
        eyebrow="Performance · by format"
        title={
          <span className="flex items-center gap-3">
            Performance
            <ConfidenceBadge sample={totalCount} compact />
          </span>
        }
      >
        How your content performs across formats — what the algorithm rewards,
        and where it quietly demotes.
      </ScreenHead>

      <div className="mt-6">
        <FormatAnalysis posts={allPosts} isImporting={isImporting} />
      </div>
    </div>
  );
}
