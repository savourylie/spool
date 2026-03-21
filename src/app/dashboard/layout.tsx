import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import {
  TokenExpiryBanner,
  getTokenStatus,
} from "@/components/dashboard/token-expiry-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("username, token_expires_at")
    .eq("id", session.value)
    .single();

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
        <DashboardTabs />
        {children}
      </div>
    </div>
  );
}
