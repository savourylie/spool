"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { TimingPost } from "@/components/dashboard/timing-heatmap";
import { computeBestSlots } from "@/lib/today-hub-helpers";
import { Composer, type BestTimeSlot } from "@/components/dashboard/composer";
import type { HistoricalPost } from "@/lib/engagement-prediction";

// ── Hydration-safe browser timezone ─────────────────────────────────

const subscribeBrowserTz = () => () => {};
const getBrowserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTz = () => "UTC";

// ── Helpers ─────────────────────────────────────────────────────────

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

// ── Component ───────────────────────────────────────────────────────

interface ComposeClientProps {
  heatmapPosts: TimingPost[];
  predictionPosts: HistoricalPost[];
  isImporting: boolean;
  initialTopic: string;
}

export function ComposeClient({
  heatmapPosts,
  predictionPosts,
  isImporting,
  initialTopic,
}: ComposeClientProps) {
  const timezone = useSyncExternalStore(subscribeBrowserTz, getBrowserTz, getServerTz);

  const bestTimes: BestTimeSlot[] = useMemo(() => {
    const slots = computeBestSlots(heatmapPosts, timezone, 3);
    return slots.map((s) => ({
      day: s.day,
      hour: s.hour,
      dayLabel: DAY_LABELS[s.day],
      timeLabel: formatHour(s.hour),
    }));
  }, [heatmapPosts, timezone]);

  return (
    <Composer
      predictionPosts={predictionPosts}
      bestTimes={bestTimes}
      isImporting={isImporting}
      initialTopic={initialTopic}
    />
  );
}
