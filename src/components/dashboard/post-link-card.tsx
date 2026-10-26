/* Threads CDN URLs and YouTube thumbnails are external and short-lived. */
/* eslint-disable @next/next/no-img-element */

import { ArrowSquareOut, LinkSimple, Play, YoutubeLogo } from "@phosphor-icons/react";

import { getLinkSiteName, parseYouTubeUrl } from "@/lib/link-preview";

export function PostLinkCard({
  url,
  title,
  siteName,
}: {
  url: string;
  title?: string | null;
  siteName?: string | null;
}) {
  const youtube = parseYouTubeUrl(url);
  const host = siteName ?? getLinkSiteName(url) ?? "Link";

  if (youtube) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-4 block overflow-hidden rounded-[var(--radius-sm)] border border-border bg-card transition-colors hover:border-line-strong"
      >
        <div className="relative aspect-video bg-foreground/10">
          <img
            src={youtube.thumbnailUrl}
            alt={title ?? "YouTube video thumbnail"}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-background/90 text-foreground shadow-[var(--shadow-hover)] transition-transform group-hover:scale-105">
              <Play weight="fill" className="ml-0.5 size-5" />
            </span>
          </span>
        </div>
        <div className="flex items-start gap-2 px-3 py-2.5">
          <YoutubeLogo weight="fill" className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium">
              {title ?? "Watch on YouTube"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
              YouTube · youtu.be/{youtube.id}
            </p>
          </div>
          <ArrowSquareOut
            weight="bold"
            className="ml-auto size-3.5 shrink-0 text-ink-4 group-hover:text-foreground"
          />
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-4 flex items-start gap-3 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-3 transition-colors hover:border-line-strong"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-paper-2 text-ink-3">
        <LinkSimple weight="bold" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {title ?? host}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
          {url.replace(/^https?:\/\//, "")}
        </span>
      </span>
      <ArrowSquareOut
        weight="bold"
        className="ml-auto size-3.5 shrink-0 text-ink-4 group-hover:text-foreground"
      />
    </a>
  );
}
