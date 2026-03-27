"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { TopicSuggestions } from "@/components/dashboard/topic-suggestions";
import { GrokTrending } from "@/components/dashboard/grok-trending";
import { YouTubeInspiration } from "@/components/dashboard/youtube-inspiration";
import { QuickScan } from "@/components/dashboard/quick-scan";
import { QuickCompose } from "@/components/dashboard/quick-compose";

// ── Types ────────────────────────────────────────────────────────────

interface DiscoverClientProps {
  topics: string[];
}

// ── Component ────────────────────────────────────────────────────────

export function DiscoverClient({ topics }: DiscoverClientProps) {
  const router = useRouter();

  const handleSelectTopic = useCallback(
    (topicName: string) => {
      router.push(
        `/dashboard/create/compose?topic=${encodeURIComponent(topicName)}`,
      );
    },
    [router],
  );

  return (
    <>
      {/* Row 1: Topic Suggestions + Grok Trending */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopicSuggestions onSelectTopic={handleSelectTopic} />
        <GrokTrending topics={topics} />
      </div>

      {/* Row 2: YouTube Inspiration (full width) */}
      <div className="mt-6">
        <YouTubeInspiration topics={topics} />
      </div>

      {/* Row 3: Quick Scan + Quick Compose */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickScan />
        <QuickCompose />
      </div>
    </>
  );
}
