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
import { Composer, type BestTimeSlot } from "@/components/dashboard/composer";

// ── Best-times computation ───────────────────────────────────────────

const MIN_POSTS_FOR_CELL = 2;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function computeBestTimes(
  posts: TimingPost[],
  timezone: string,
): BestTimeSlot[] {
  type Bucket = { count: number; totalEngRate: number };
  const grid: Bucket[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ count: 0, totalEngRate: 0 })),
  );

  const dayMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };

  for (const post of posts) {
    const date = new Date(post.published_at);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(date);

    const weekdayStr =
      parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const day = dayMap[weekdayStr] ?? 0;
    const hour = parseInt(hourStr, 10) % 24;

    const engRate =
      post.views > 0
        ? ((post.likes + post.replies + post.reposts + post.quotes + post.shares) /
            post.views) *
          100
        : 0;

    grid[day][hour].count += 1;
    grid[day][hour].totalEngRate += engRate;
  }

  const candidates: { day: number; hour: number; avg: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (grid[d][h].count >= MIN_POSTS_FOR_CELL) {
        candidates.push({
          day: d,
          hour: h,
          avg: grid[d][h].totalEngRate / grid[d][h].count,
        });
      }
    }
  }
  candidates.sort((a, b) => b.avg - a.avg);

  return candidates.slice(0, 3).map((c) => ({
    day: c.day,
    hour: c.hour,
    dayLabel: DAY_LABELS[c.day],
    timeLabel: formatHour(c.hour),
  }));
}

// ── Page ─────────────────────────────────────────────────────────────

export default async function ComposePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const supabase = createAdminClient();
  const userId = session.value;

  const [heatmapResult, predictionResult, backfillResult] = await Promise.all([
    // Posts with metrics for best-times computation
    supabase.rpc("get_timing_heatmap_data" as never, {
      p_user_id: userId,
    } as never) as unknown as Promise<{
      data: TimingPost[] | null;
      error: { message: string } | null;
    }>,
    // Historical posts for engagement prediction
    supabase.rpc("get_posts_with_metrics", {
      p_user_id: userId,
      p_limit: 500,
      p_offset: 0,
      p_sort_column: "published_at",
      p_sort_order: "desc",
    }),
    // Backfill status
    getMostRecentBackfillJob(supabase, userId),
  ]);

  // Compute best posting times (server-side, using UTC as default)
  const heatmapPosts = heatmapResult.data ?? [];
  const bestTimes = computeBestTimes(heatmapPosts, "UTC");

  // Map prediction posts
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
        <Composer
          predictionPosts={predictionPosts}
          bestTimes={bestTimes}
          isImporting={isImporting}
        />
      </StickerCardContent>
    </StickerCard>
  );
}
