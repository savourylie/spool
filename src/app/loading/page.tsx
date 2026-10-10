import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { BackfillProgress } from "@/components/backfill-progress";
import { BACKFILL_JOB_SELECT_FIELDS, toBackfillJob } from "@/lib/backfill-job";

export default async function LoadingPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!userId) {
    redirect("/");
  }

  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from("backfill_jobs")
    .select(BACKFILL_JOB_SELECT_FIELDS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!job || job.status === "complete") {
    redirect("/dashboard");
  }

  return (
    <BackfillProgress initialJob={toBackfillJob(job)} />
  );
}
