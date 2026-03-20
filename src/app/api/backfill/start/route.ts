import { type NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { runBackfill } from "@/lib/backfill";

export async function POST(request: NextRequest) {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: activeJob } = await supabase
    .from("backfill_jobs")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
