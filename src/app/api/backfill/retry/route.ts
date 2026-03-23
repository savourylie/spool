import { type NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { runBackfill } from "@/lib/backfill";
import {
  getMostRecentActiveBackfillJob,
  markStaleBackfillJobFailed,
} from "@/lib/backfill-recovery";

export async function POST(request: NextRequest) {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const activeJob = await getMostRecentActiveBackfillJob(supabase, userId);

  if (activeJob) {
    const staleActiveJob = await markStaleBackfillJobFailed(
      supabase,
      userId,
      activeJob,
    );

    if (staleActiveJob.status !== "failed") {
      return NextResponse.json(
        {
          error: "An import is already in progress",
          jobId: activeJob.id,
          status: activeJob.status,
        },
        { status: 409 },
      );
    }
  }

  // Create a new pending backfill job
  const { data: job, error } = await supabase
    .from("backfill_jobs")
    .insert({ user_id: userId, status: "pending" })
    .select("id")
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: "Failed to create backfill job" },
      { status: 500 },
    );
  }

  after(async () => {
    await runBackfill(userId, job.id);
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
