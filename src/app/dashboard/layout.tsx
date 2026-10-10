import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { DashboardBackfillBanner } from "@/components/dashboard/backfill-status-banner";
import {
  TokenExpiryBanner,
  getTokenStatus,
} from "@/components/dashboard/token-expiry-banner";
import {
  getMostRecentBackfillJob,
} from "@/lib/backfill-recovery";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;
  const [{ data: user }, backfillJob] = await Promise.all([
    supabase
      .from("users")
      .select("username, token_expires_at")
      .eq("id", userId)
      .single(),
    getMostRecentBackfillJob(supabase, userId),
  ]);

  if (!user?.username) redirect("/");

  const tokenStatus = user.token_expires_at
    ? getTokenStatus(user.token_expires_at)
    : "valid";

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar username={user.username} />
      <main className="flex min-h-screen flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          {tokenStatus !== "valid" && (
            <div className="mb-4">
              <TokenExpiryBanner status={tokenStatus} />
            </div>
          )}
          <DashboardBackfillBanner
            initialJob={backfillJob}
          />
          {children}
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}
