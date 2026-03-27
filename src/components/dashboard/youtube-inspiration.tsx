"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { Play } from "@phosphor-icons/react/dist/ssr/Play";

import type { YouTubeVideo } from "@/app/api/youtube-suggestions/route";

// ── Types ────────────────────────────────────────────────────────────

interface YouTubeInspirationProps {
  topics: string[];
}

// ── Skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-sm)] border-2 border-border">
      <div className="aspect-video animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-4 w-full animate-pulse rounded bg-border" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-border" />
        <div className="h-5 w-24 animate-pulse rounded-full bg-border" />
      </div>
    </div>
  );
}

// ── Video Card ───────────────────────────────────────────────────────

function VideoCard({ video }: { video: YouTubeVideo }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-[var(--radius-sm)] border-2 border-border bg-card transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--foreground)]">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-foreground/10">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play weight="fill" className="size-10 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {video.title}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{video.channelName}</span>
          <span>&middot;</span>
          <span className="shrink-0">{video.viewCount}</span>
        </div>

        <span className="w-fit rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
          Matches: {video.matchedTopic}
        </span>

        <Link
          href={`/dashboard/create/compose?topic=${encodeURIComponent(video.title)}`}
          className="mt-auto inline-flex items-center gap-1 self-start rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-foreground transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--foreground)]"
        >
          Use as inspiration
          <ArrowRight weight="bold" className="size-3" />
        </Link>
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function YouTubeInspiration({ topics }: YouTubeInspirationProps) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(topics.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (topics.length === 0) return;

    const controller = new AbortController();

    fetch("/api/youtube-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch videos");
        return res.json();
      })
      .then((data) => {
        setVideos(data.videos ?? []);
        setIsLoading(false);
        setError(null);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError("Failed to load video suggestions");
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [topics, retryCount]);

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-destructive text-white">
          <YoutubeLogo weight="bold" className="size-4" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          YouTube Inspiration
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SpinnerGap
              weight="bold"
              className="size-4 animate-spin text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Finding inspiring videos&hellip;
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setError(null);
              setRetryCount((c) => c + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:bg-tertiary"
          >
            <ArrowClockwise weight="bold" className="size-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty — no topics provided */}
      {!isLoading && !error && topics.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          Post more to discover inspiring video content in your niche.
        </p>
      )}

      {/* Empty — no videos found */}
      {!isLoading && !error && topics.length > 0 && videos.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          No relevant videos found right now.
        </p>
      )}

      {/* Video grid */}
      {!isLoading && !error && videos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.slice(0, 3).map((video) => (
            <VideoCard key={video.videoUrl} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
