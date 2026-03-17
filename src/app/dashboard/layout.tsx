import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";

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
    .select("username")
    .eq("id", session.value)
    .single();

  if (!user?.username) redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader username={user.username} />
      <div className="mx-auto max-w-6xl px-6">
        <DashboardTabs />
        {children}
      </div>
    </div>
  );
}
