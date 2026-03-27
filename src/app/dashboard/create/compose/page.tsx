import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";

import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";
import type { HistoricalPost } from "@/lib/engagement-prediction";
import type { TimingPost } from "@/components/dashboard/timing-heatmap";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import { ComposeClient } from "@/components/dashboard/compose-client";

export default async function CreateComposePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const params = await searchParams;
  const initialTopic = params.topic ?? "";

  const supabase = createAdminClient();
  const userId = session.value;

  const [heatmapResult, predictionResult, backfillResult] = await Promise.all([
    supabase.rpc("get_timing_heatmap_data" as never, {
      p_user_id: userId,
    } as never) as unknown as Promise<{
      data: TimingPost[] | null;
      error: { message: string } | null;
    }>,
    supabase.rpc("get_posts_with_metrics", {
      p_user_id: userId,
      p_limit: 500,
      p_offset: 0,
      p_sort_column: "published_at",
      p_sort_order: "desc",
    }),
    getMostRecentBackfillJob(supabase, userId),
  ]);

  const heatmapPosts: TimingPost[] = heatmapResult.data ?? [];

  const predictionPosts: HistoricalPost[] = (
    predictionResult.data ?? []
  ).map((p) => ({
    views: p.views,
    media_type: p.media_type,
    text_length: (p.text_preview ?? "").length,
    published_at: p.published_at,
    topic_tag: null,
  }));

  const isImporting = isImportingBackfillStatus(backfillResult?.status);

  return (
    <StickerCard className="pt-8 hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="primary">
        <PencilLine weight="fill" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>AI Composer</StickerCardTitle>
        <StickerCardDescription>
          Draft algorithm-optimized posts powered by your own performance data.
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <ComposeClient
          heatmapPosts={heatmapPosts}
          predictionPosts={predictionPosts}
          isImporting={isImporting}
          initialTopic={initialTopic}
        />
      </StickerCardContent>
    </StickerCard>
  );
}
