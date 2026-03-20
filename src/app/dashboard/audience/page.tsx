import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  StickerCard,
  StickerCardContent,
} from "@/components/ui/card";
import {
  FollowerChart,
  type DailyStatRow,
  type PostSummary,
} from "@/components/dashboard/follower-chart";

export default async function AudiencePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  const [statsResult, postsResult] = await Promise.all([
    supabase
      .from("daily_stats")
      .select("date, followers_count")
      .eq("user_id", userId)
      .order("date", { ascending: true }),
    supabase
      .from("posts")
      .select("id, text_preview, permalink, published_at")
      .eq("user_id", userId)
      .order("published_at", { ascending: true }),
  ]);

  if (statsResult.error) {
    return (
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardContent>
          <p className="text-destructive">
            Failed to load audience data: {statsResult.error.message}
          </p>
        </StickerCardContent>
      </StickerCard>
    );
  }

  return (
    <FollowerChart
      dailyStats={(statsResult.data ?? []) as DailyStatRow[]}
      posts={(postsResult.data ?? []) as PostSummary[]}
    />
  );
}
