"use client";

/* Threads serves signed CDN URLs; next/image's cache would keep stale bytes. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  Image as ImageIcon,
  Play,
  SquaresFour,
  VideoCamera,
} from "@phosphor-icons/react";

import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

interface CarouselItem {
  id?: string;
  media_type?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  alt_text?: string | null;
}

interface PostMediaSource {
  id: string;
  media_type: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  gif_url?: string | null;
  children?: Json;
}

interface MediaState {
  url: string | null;
  poster: string | null;
  alt: string | null;
  gif: string | null;
  carousel: CarouselItem[];
}

function readChildren(value: Json | undefined): CarouselItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return data
    .filter((entry): entry is Record<string, unknown> => {
      return typeof entry === "object" && entry !== null && !Array.isArray(entry);
    })
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : undefined,
      media_type: typeof entry.media_type === "string" ? entry.media_type : null,
      media_url: typeof entry.media_url === "string" ? entry.media_url : null,
      thumbnail_url:
        typeof entry.thumbnail_url === "string" ? entry.thumbnail_url : null,
      alt_text: typeof entry.alt_text === "string" ? entry.alt_text : null,
    }));
}

function toInitialState(post: PostMediaSource): MediaState {
  return {
    url: post.media_url ?? null,
    poster: post.thumbnail_url ?? null,
    alt: post.alt_text ?? null,
    gif: post.gif_url ?? null,
    carousel: readChildren(post.children),
  };
}

export function PostMedia({
  post,
  className,
}: {
  post: PostMediaSource;
  className?: string;
}) {
  const initial = useMemo(() => toInitialState(post), [post]);
  const [state, setState] = useState<MediaState>(initial);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const inFlight = useRef(false);
  const attempted = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsRefreshing(true);

    try {
      const response = await fetch(`/api/posts/${post.id}/media`);
      if (!response.ok) throw new Error("Media refresh failed");

      const data = (await response.json()) as {
        media_url: string | null;
        thumbnail_url: string | null;
        alt_text: string | null;
        gif_url: string | null;
        carousel?: CarouselItem[];
      };

      setState({
        url: data.media_url,
        poster: data.thumbnail_url,
        alt: data.alt_text,
        gif: data.gif_url,
        carousel: Array.isArray(data.carousel) ? data.carousel : [],
      });
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, [post.id]);

  const handleMediaError = useCallback(() => {
    if (attempted.current) {
      setUnavailable(true);
      return;
    }
    attempted.current = true;
    void refresh();
  }, [refresh]);

  const hasUnresolvedChildren =
    state.carousel.length > 1 &&
    state.carousel.some((item) => !item.media_url && !item.thumbnail_url);

  useEffect(() => {
    if (post.media_type !== "CAROUSEL" || !hasUnresolvedChildren) return;
    if (attempted.current) return;
    attempted.current = true;
    void refresh();
  }, [hasUnresolvedChildren, post.media_type, refresh]);

  const isGifOnly = !state.url && Boolean(state.gif);
  if (post.media_type === "TEXT" && !isGifOnly) return null;

  if (unavailable && !state.url && !state.poster && state.carousel.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-40 flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-line-strong bg-paper-2 p-6 text-center",
          className,
        )}
      >
        <ImageIcon weight="regular" className="size-6 text-ink-4" />
        <p className="text-xs text-ink-3">
          Preview unavailable. Threads media links expire after a few days.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <ArrowsClockwise weight="bold" className="size-3.5" />
          Refresh preview
        </button>
      </div>
    );
  }

  if (isGifOnly && state.gif) {
    return (
      <div className={cn("overflow-hidden rounded-[var(--radius-sm)] border border-border bg-paper-2", className)}>
        <img
          src={state.gif}
          alt={state.alt ?? "GIF"}
          className="max-h-[560px] w-full object-contain"
          onError={handleMediaError}
        />
      </div>
    );
  }

  if (post.media_type === "CAROUSEL") {
    const items = state.carousel.filter(
      (item) => item.media_url || item.thumbnail_url,
    );

    if (items.length > 1) {
      return (
        <div className={cn("relative", className)}>
          <div
            className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2"
            role="group"
            aria-label="Carousel items"
            tabIndex={0}
          >
            {items.map((item, index) => {
              const src = item.media_url ?? item.thumbnail_url;
              if (!src) return null;
              return (
                <div
                  key={item.id ?? index}
                  className="relative w-[88%] shrink-0 snap-center overflow-hidden rounded-[var(--radius-sm)] border border-border bg-paper-2"
                >
                  <img
                    src={src}
                    alt={item.alt_text ?? `Carousel item ${index + 1}`}
                    className="max-h-[520px] w-full object-contain"
                    onError={handleMediaError}
                  />
                  {item.media_type === "VIDEO" ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                      <Play weight="fill" className="size-10 text-background" />
                    </span>
                  ) : null}
                  <span className="absolute right-2 top-2 rounded-[var(--radius-sm)] bg-foreground/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-background">
                    {index + 1}/{items.length}
                  </span>
                </div>
              );
            })}
          </div>
          {isRefreshing ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
              Refreshing carousel…
            </span>
          ) : null}
        </div>
      );
    }

    const cover = state.url ?? state.poster ?? items[0]?.media_url ?? items[0]?.thumbnail_url;
    const count = Math.max(state.carousel.length, items.length);

    if (!cover) return null;

    return (
      <div className={cn("relative overflow-hidden rounded-[var(--radius-sm)] border border-border bg-paper-2", className)}>
        <img
          src={cover}
          alt={state.alt ?? "Carousel cover"}
          className="max-h-[560px] w-full object-contain"
          onError={handleMediaError}
        />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-foreground/80 px-2 py-1 font-mono text-[10px] text-background">
          <SquaresFour weight="bold" className="size-3" />
          {count > 1 ? `${count} items` : "Carousel"}
        </span>
      </div>
    );
  }

  if (post.media_type === "VIDEO") {
    if (!state.url) {
      if (!state.poster) return null;
      return (
        <div className={cn("relative overflow-hidden rounded-[var(--radius-sm)] border border-border bg-paper-2", className)}>
          <img
            src={state.poster}
            alt={state.alt ?? "Video thumbnail"}
            className="max-h-[560px] w-full object-contain"
            onError={handleMediaError}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
            <Play weight="fill" className="size-12 text-background" />
          </span>
        </div>
      );
    }

    return (
      <div className={cn("overflow-hidden rounded-[var(--radius-sm)] border border-border bg-paper-2", className)}>
        <video
          controls
          playsInline
          preload="metadata"
          poster={state.poster ?? undefined}
          className="max-h-[560px] w-full"
          onError={handleMediaError}
        >
          <source src={state.url} />
        </video>
      </div>
    );
  }

  if (!state.url) return null;

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-sm)] border border-border bg-paper-2", className)}>
      <img
        src={state.url}
        alt={state.alt ?? "Post image"}
        className="max-h-[560px] w-full object-contain"
        onError={handleMediaError}
      />
    </div>
  );
}

export function MediaTypeGlyph({ mediaType }: { mediaType: string }) {
  if (mediaType === "VIDEO") return <VideoCamera weight="regular" className="size-3.5" />;
  if (mediaType === "CAROUSEL") return <SquaresFour weight="regular" className="size-3.5" />;
  if (mediaType === "IMAGE") return <ImageIcon weight="regular" className="size-3.5" />;
  return null;
}
