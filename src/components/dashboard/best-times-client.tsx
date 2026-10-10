"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { TimingPost } from "@/components/dashboard/timing-heatmap";
import { BestTimesSection } from "@/components/dashboard/best-times-section";

const MIN_POSTS_FOR_CELL = 2; // mirrors timing-heatmap.tsx

// Hydration-safe browser timezone (same pattern as timing-heatmap.tsx)
const subscribeBrowserTz = () => () => {};
const getBrowserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTz = () => "UTC";

export function BestTimesClient({ posts }: { posts: TimingPost[] }) {
  const timezone = useSyncExternalStore(subscribeBrowserTz, getBrowserTz, getServerTz);

  const bestSlots = useMemo(() => {
    const grid = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ count: 0, totalEngRate: 0 }))
    );

    for (const post of posts) {
      const date = new Date(post.published_at);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        hour: "numeric",
        hour12: false,
      }).formatToParts(date);

      const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
      const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";

      const dayMap: Record<string, number> = {
        Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
      };
      const day = dayMap[weekdayStr] ?? 0;
      const hour = parseInt(hourStr, 10) % 24;

      const engRate =
        post.views > 0
          ? ((post.likes + post.replies + post.reposts + post.quotes + post.shares) / post.views) * 100
          : 0;

      grid[day][hour].count += 1;
      grid[day][hour].totalEngRate += engRate;
    }

    const candidates: { day: number; hour: number; avg: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h].count >= MIN_POSTS_FOR_CELL) {
          candidates.push({ day: d, hour: h, avg: grid[d][h].totalEngRate / grid[d][h].count });
        }
      }
    }
    candidates.sort((a, b) => b.avg - a.avg);
    return candidates.slice(0, 3);
  }, [posts, timezone]);

  return <BestTimesSection bestSlots={bestSlots} />;
}
