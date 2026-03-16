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

  // Find the most recent pending backfill job for this user
  const { data: job, error } = await supabase
    .from("backfill_jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
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
