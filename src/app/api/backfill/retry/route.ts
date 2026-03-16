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
