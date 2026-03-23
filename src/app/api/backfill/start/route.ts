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
  let activeJob = await getMostRecentActiveBackfillJob(supabase, userId);

  if (activeJob) {
    const staleActiveJob = await markStaleBackfillJobFailed(
      supabase,
      userId,
      activeJob,
    );

    if (staleActiveJob.status === "failed") {
      activeJob = null;
    }
  }

  if (activeJob?.status === "running") {
    console.log("Backfill start skipped: job already running", {
      userId,
      jobId: activeJob.id,
    });
    return NextResponse.json(
      { jobId: activeJob.id, status: activeJob.status },
      { status: 200 },
    );
  }

  // Find the most recent pending backfill job for this user
  const job = activeJob?.status === "pending" ? activeJob : null;

  if (!job) {
    console.warn("Backfill start requested without a pending job", { userId });
    return NextResponse.json(
      { error: "No pending backfill job found" },
      { status: 404 },
    );
  }

  // Run backfill after the response is sent (keeps serverless function alive)
  after(async () => {
    await runBackfill(userId, job.id);
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
