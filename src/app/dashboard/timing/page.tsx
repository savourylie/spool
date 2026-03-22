import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import { TimingHeatmap, type TimingPost } from "@/components/dashboard/timing-heatmap";
import {
  BACKFILL_JOB_SELECT_FIELDS,
  BACKFILL_VISIBLE_STATUSES,
  isImportingBackfillStatus,
  toBackfillJob,
} from "@/lib/backfill-job";

export default async function TimingPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  const [postsResult, backfillResult] = await Promise.all([
    supabase.rpc("get_timing_heatmap_data" as never, {
      p_user_id: userId,
    } as never) as unknown as Promise<{
      data: TimingPost[] | null;
      error: { message: string } | null;
    }>,
    supabase
      .from("backfill_jobs")
      .select(BACKFILL_JOB_SELECT_FIELDS)
      .eq("user_id", userId)
      .in("status", [...BACKFILL_VISIBLE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: posts, error } = postsResult;

  if (error || !posts) {
    return <ErrorState description="We couldn't load your timing data right now." />;
  }

  const backfillJob = backfillResult.data
    ? toBackfillJob(backfillResult.data)
    : null;

  return (
    <TimingHeatmap
      posts={posts}
      isImporting={isImportingBackfillStatus(backfillJob?.status)}
    />
  );
}
