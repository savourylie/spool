import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { DiscoverClient } from "@/components/dashboard/discover-client";

export default async function CreatePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  // Fetch unique topic tags for GrokTrending and YouTubeInspiration
  const { data: tagRows } = await supabase
    .from("posts")
    .select("topic_tag")
    .eq("user_id", userId)
    .not("topic_tag", "is", null)
    .order("published_at", { ascending: false })
    .limit(30);

  const topics = [
    ...new Set(
      (tagRows ?? [])
        .map((r) => r.topic_tag)
        .filter((t): t is string => t != null),
    ),
  ];

  return (
    <div className="py-8">
      <h1 className="font-heading text-3xl font-bold">Discover</h1>
      <p className="mt-2 text-muted-foreground">
        Find inspiration and create your next post.
      </p>

      <DiscoverClient topics={topics} />
    </div>
  );
}
