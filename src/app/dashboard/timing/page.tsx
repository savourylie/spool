import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ErrorState } from "@/components/ui/error-state";
import { ScreenHead } from "@/components/dashboard/screen-head";
import {
  TimingHeatmap,
  type TimingPost,
} from "@/components/dashboard/timing-heatmap";
import { BestTimesClient } from "@/components/dashboard/best-times-client";
import { CadenceOptimizer } from "@/components/dashboard/cadence-optimizer";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";

export const metadata: Metadata = { title: "Timing — Spool" };

export default async function TimingPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  const [timingResult, backfillJob] = await Promise.all([
    supabase.rpc("get_timing_heatmap_data" as never, {
      p_user_id: userId,
    } as never) as unknown as Promise<{
      data: TimingPost[] | null;
      error: { message: string } | null;
    }>,
    getMostRecentBackfillJob(supabase, userId),
  ]);

  const { data: timingData, error: timingError } = timingResult;

  if (timingError || !timingData) {
    return (
      <ErrorState description="We couldn't load your timing data right now." />
    );
  }

  const timingPosts: TimingPost[] = timingData;
  const isImporting = isImportingBackfillStatus(backfillJob?.status);

  return (
    <div className="py-8">
      <ScreenHead eyebrow="Best windows · 7 × 24" title="Timing">
        When your audience is awake — built from your own posting history, not a
        generic recommendation.
      </ScreenHead>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <TimingHeatmap posts={timingPosts} isImporting={isImporting} />
        <div className="space-y-6">
          <BestTimesClient posts={timingPosts} />
          <CadenceOptimizer posts={timingPosts} isImporting={isImporting} />
        </div>
      </div>
    </div>
  );
}
