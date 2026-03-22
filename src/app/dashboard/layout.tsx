import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { DashboardBackfillBanner } from "@/components/dashboard/backfill-status-banner";
import {
  TokenExpiryBanner,
  getTokenStatus,
} from "@/components/dashboard/token-expiry-banner";
import {
  BACKFILL_JOB_SELECT_FIELDS,
  BACKFILL_VISIBLE_STATUSES,
  toBackfillJob,
} from "@/lib/backfill-job";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const [{ data: user }, { data: backfillJob }] = await Promise.all([
    supabase
      .from("users")
      .select("username, token_expires_at")
      .eq("id", session.value)
      .single(),
    supabase
      .from("backfill_jobs")
      .select(BACKFILL_JOB_SELECT_FIELDS)
      .eq("user_id", session.value)
      .in("status", [...BACKFILL_VISIBLE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!user?.username) redirect("/");

  const tokenStatus = user.token_expires_at
    ? getTokenStatus(user.token_expires_at)
    : "valid";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader username={user.username} />
      <div className="mx-auto max-w-6xl px-6">
        {tokenStatus !== "valid" && (
          <div className="mb-4">
            <TokenExpiryBanner status={tokenStatus} />
          </div>
        )}
        <DashboardBackfillBanner
          initialJob={backfillJob ? toBackfillJob(backfillJob) : null}
        />
        <DashboardTabs />
        {children}
      </div>
    </div>
  );
}
