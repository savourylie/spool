import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  StickerCard,
  StickerCardContent,
} from "@/components/ui/card";
import { TimingHeatmap, type TimingPost } from "@/components/dashboard/timing-heatmap";

export default async function TimingPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  const { data: posts, error } = await supabase.rpc("get_timing_heatmap_data" as never, {
    p_user_id: userId,
  } as never) as { data: TimingPost[] | null; error: { message: string } | null };

  if (error || !posts) {
    return (
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardContent>
          <p className="text-destructive">
            Failed to load timing data{error ? `: ${error.message}` : "."}
          </p>
        </StickerCardContent>
      </StickerCard>
    );
  }

  return <TimingHeatmap posts={posts} />;
}
