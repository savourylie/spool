/**
 * Today Hub Helpers
 *
 * Pure functions that prepare data for the Today Hub summary cards.
 * No database calls, no side effects — accepts pre-fetched data and
 * returns derived display values.
 */

import type { PostRow } from "@/components/dashboard/post-table";
import type { TimingPost } from "@/components/dashboard/timing-heatmap";
import { computeWES } from "@/lib/weighted-engagement";
import type { FormatBreakdown } from "@/lib/format-analysis";

// ── Types ─────────────────────────────────────────────────────────────

export type CadenceStatus = "on_track" | "due" | "overdue";

export interface CadenceStatusResult {
  status: CadenceStatus;
  hoursAgo: number;
}

export interface MiniHeatmapCell {
  dayIndex: number;    // 0-6 (Mon-Sun)
  periodIndex: number; // 0=AM, 1=PM, 2=Evening
  intensity: number;   // 0-1 normalized
}

export interface BestSlot {
  day: number;
  hour: number;
  dayLabel: string;
  timeLabel: string;
  avgEngagement: number;
}

export type VelocityTrend = "up" | "down" | "flat";

// ── Constants ─────────────────────────────────────────────────────────

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const MIN_POSTS_FOR_SLOT = 2;

/** Map 24 hours into 3 time-of-day periods. */
function hourToPeriod(hour: number): number {
  if (hour >= 6 && hour <= 11) return 0;  // AM
  if (hour >= 12 && hour <= 17) return 1; // PM
  return 2;                                // Evening (18-23, 0-5)
}

// ── Cadence Status ────────────────────────────────────────────────────

export function deriveCadenceStatus(
  lastPostAt: string | null,
  now: Date,
): CadenceStatusResult {
  if (!lastPostAt) {
    return { status: "overdue", hoursAgo: Infinity };
  }

  const hoursAgo = (now.getTime() - new Date(lastPostAt).getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 24) return { status: "on_track", hoursAgo };
  if (hoursAgo < 36) return { status: "due", hoursAgo };
  return { status: "overdue", hoursAgo };
}

// ── Mini Heatmap ──────────────────────────────────────────────────────

export function computeMiniHeatmap(
  posts: TimingPost[],
  timezone: string,
): MiniHeatmapCell[] {
  // Build a 7×3 grid (day × period)
  const grid: { count: number; totalEngRate: number }[][] = Array.from(
    { length: 7 },
    () => Array.from({ length: 3 }, () => ({ count: 0, totalEngRate: 0 })),
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

    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const day = dayMap[weekdayStr] ?? 0;
    const hour = parseInt(hourStr, 10) % 24;
    const period = hourToPeriod(hour);

    const engRate =
      post.views > 0
        ? ((post.likes + post.replies + post.reposts + post.quotes + post.shares) / post.views) * 100
        : 0;

    grid[day][period].count += 1;
    grid[day][period].totalEngRate += engRate;
  }

  // Compute average engagement per cell, then normalize
  const avgs: { dayIndex: number; periodIndex: number; avg: number }[] = [];
  let maxAvg = 0;

  for (let d = 0; d < 7; d++) {
    for (let p = 0; p < 3; p++) {
      const cell = grid[d][p];
      const avg = cell.count > 0 ? cell.totalEngRate / cell.count : 0;
      avgs.push({ dayIndex: d, periodIndex: p, avg });
      if (avg > maxAvg) maxAvg = avg;
    }
  }

  return avgs.map(({ dayIndex, periodIndex, avg }) => ({
    dayIndex,
    periodIndex,
    intensity: maxAvg > 0 ? avg / maxAvg : 0,
  }));
}

// ── Next Best Slot ────────────────────────────────────────────────────

export function computeNextBestSlot(
  posts: TimingPost[],
  timezone: string,
): BestSlot | null {
  // Build 7×24 grid (same approach as timing-heatmap.tsx)
  const grid: { count: number; totalEngRate: number }[][] = Array.from(
    { length: 7 },
    () => Array.from({ length: 24 }, () => ({ count: 0, totalEngRate: 0 })),
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

    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const day = dayMap[weekdayStr] ?? 0;
    const hour = parseInt(hourStr, 10) % 24;

    const engRate =
      post.views > 0
        ? ((post.likes + post.replies + post.reposts + post.quotes + post.shares) / post.views) * 100
        : 0;

    grid[day][hour].count += 1;
    grid[day][hour].totalEngRate += engRate;
  }

  // Find best slot among cells with enough data
  let best: { day: number; hour: number; avg: number } | null = null;

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (grid[d][h].count >= MIN_POSTS_FOR_SLOT) {
        const avg = grid[d][h].totalEngRate / grid[d][h].count;
        if (!best || avg > best.avg) {
          best = { day: d, hour: h, avg };
        }
      }
    }
  }

  if (!best) return null;

  const timeLabel =
    best.hour === 0
      ? "12:00 AM"
      : best.hour < 12
        ? `${best.hour}:00 AM`
        : best.hour === 12
          ? "12:00 PM"
          : `${best.hour - 12}:00 PM`;

  return {
    day: best.day,
    hour: best.hour,
    dayLabel: DAY_LABELS[best.day],
    timeLabel,
    avgEngagement: best.avg,
  };
}

// ── Velocity Trend ────────────────────────────────────────────────────

export function computeVelocityTrend(
  thisWeekAvgEng: number,
  lastWeekAvgEng: number,
): VelocityTrend {
  if (lastWeekAvgEng === 0) return thisWeekAvgEng > 0 ? "up" : "flat";
  const change = (thisWeekAvgEng - lastWeekAvgEng) / lastWeekAvgEng;
  if (change > 0.1) return "up";
  if (change < -0.1) return "down";
  return "flat";
}

// ── Why Factors ───────────────────────────────────────────────────────

export function generateWhyFactors(
  post: PostRow,
  bestSlots: { day: number; hour: number }[],
  formatBreakdown: FormatBreakdown[],
  timezone: string,
): string[] {
  const factors: string[] = [];

  // 1. Timing: was this post at an optimal time?
  if (bestSlots.length > 0) {
    const date = new Date(post.published_at);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(date);

    const dayMap: Record<string, number> = {
      Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    };
    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const day = dayMap[weekdayStr] ?? 0;
    const hour = parseInt(hourStr, 10) % 24;

    const timeLabel =
      hour === 0
        ? "12 AM"
        : hour < 12
          ? `${hour} AM`
          : hour === 12
            ? "12 PM"
            : `${hour - 12} PM`;

    if (bestSlots.some((s) => s.day === day && s.hour === hour)) {
      factors.push(`Posted at optimal time (${DAY_LABELS[day].slice(0, 3)} ${timeLabel})`);
    }
  }

  // 2. Format: does this media type match the user's best format?
  if (formatBreakdown.length >= 2) {
    let bestFormat = formatBreakdown[0];
    for (const f of formatBreakdown) {
      if (f.avgWes > bestFormat.avgWes) bestFormat = f;
    }
    if (post.media_type === bestFormat.mediaType) {
      const label = bestFormat.mediaType === "TEXT"
        ? "Text-only format (your strongest)"
        : `${capitalize(bestFormat.mediaType.toLowerCase())} format (your strongest)`;
      factors.push(label);
    }
  }

  // 3. Content length: longer posts tend to outperform
  const textLen = post.text_preview?.length ?? 0;
  if (textLen > 150) {
    factors.push("Long-form content (outperforms short posts)");
  } else if (textLen > 50) {
    factors.push("Medium-length post (solid engagement range)");
  }

  return factors.slice(0, 3);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Find Best Post ────────────────────────────────────────────────────

export function findBestPost(posts: PostRow[]): PostRow | null {
  if (posts.length === 0) return null;

  let best = posts[0];
  let bestWes = computeWES({
    views: best.views,
    likes: best.likes,
    replies: best.replies,
    reposts: best.reposts,
    quotes: best.quotes,
    shares: best.shares,
  });

  for (let i = 1; i < posts.length; i++) {
    const wes = computeWES({
      views: posts[i].views,
      likes: posts[i].likes,
      replies: posts[i].replies,
      reposts: posts[i].reposts,
      quotes: posts[i].quotes,
      shares: posts[i].shares,
    });
    if (wes > bestWes) {
      best = posts[i];
      bestWes = wes;
    }
  }

  return best;
}
