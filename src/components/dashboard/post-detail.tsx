"use client";

import Link from "next/link";
import {
  ArrowSquareOut,
  MagnifyingGlass,
  Quotes,
  X,
} from "@phosphor-icons/react";

import { CommentQuality } from "./comment-quality";
import { PostLinkCard } from "./post-link-card";
import { PostMedia } from "./post-media";
import { PostMetricsSparkline } from "./post-metrics-sparkline";
import { VelocityIndicator } from "./velocity-indicator";
import { formatNumber } from "@/lib/engagement-prediction";
import { POST_MEDIA_LABELS, type StoredPostMediaType } from "@/lib/post-media-type";
import type { PostRow } from "@/lib/post-row";
import type { VelocityResult } from "@/lib/velocity-scoring";
import { computeNormalizedWES } from "@/lib/weighted-engagement";
import { cn } from "@/lib/utils";

const METRICS: { key: keyof PostRow; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "replies", label: "Replies" },
  { key: "reposts", label: "Reposts" },
  { key: "quotes", label: "Quotes" },
  { key: "shares", label: "Shares" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PostDetail({
  post,
  username,
  isImporting = false,
  velocity,
  onClose,
}: {
  post: PostRow;
  username: string;
  isImporting?: boolean;
  velocity?: VelocityResult;
  onClose?: () => void;
}) {
  const wes = computeNormalizedWES(post);
  const text = post.text_full ?? post.text_preview;
  const mediaLabel =
    POST_MEDIA_LABELS[post.media_type as StoredPostMediaType] ?? post.media_type;

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="eyebrow flex flex-wrap items-center gap-2">
            <span>Post · {mediaLabel}</span>
            {post.is_quote_post ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-line-strong bg-paper-2 px-1.5 py-0.5 text-[9px] tracking-[0.06em] text-ink-2">
                <Quotes weight="bold" className="size-2.5" />
                Quote
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-3">
            <span>@{username}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {post.permalink ? (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              Open
              <ArrowSquareOut weight="bold" className="size-3.5" />
            </a>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close post detail"
              className="rounded-[var(--radius-sm)] p-1.5 text-ink-3 transition-colors hover:bg-paper-2 hover:text-foreground"
            >
              <X weight="bold" className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-4 py-4">
        <p
          className={cn(
            "whitespace-pre-wrap break-words text-[15px] leading-relaxed",
            !text && "text-ink-3",
          )}
        >
          {text || "No text content."}
        </p>

        {post.is_quote_post ? (
          <p className="mt-2 text-xs text-ink-3">
            Quote post — open it on Threads to read the quoted thread.
          </p>
        ) : null}

        <PostMedia post={post} className="mt-4" />

        {post.link_attachment_url ? (
          <PostLinkCard
            url={post.link_attachment_url}
            title={post.link_title}
            siteName={post.link_site_name}
          />
        ) : null}

        <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-sm)] border border-border bg-border">
          {METRICS.map((metric) => (
            <div key={metric.key} className="bg-card px-3 py-2.5">
              <dt className="eyebrow text-[9px]">{metric.label}</dt>
              <dd className="mt-0.5 font-mono text-lg leading-none tabular-nums">
                {formatNumber(Number(post[metric.key] ?? 0))}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-ink-3">Engagement rate</span>
            <span className="font-mono font-medium tabular-nums">
              {post.engagement_rate.toFixed(2)}%
            </span>
          </span>
          <span
            className="inline-flex items-baseline gap-1.5"
            title="Weighted Engagement Score — algorithm-weighted metric"
          >
            <span className="text-ink-3">WES</span>
            <span className="font-mono font-medium tabular-nums">
              {wes.toFixed(2)}
            </span>
          </span>
          {velocity ? (
            <VelocityIndicator
              score={velocity.score}
              velocity={velocity.velocity}
              average={velocity.average}
            />
          ) : null}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <PostMetricsSparkline postId={post.id} />
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <CommentQuality postId={post.id} isImporting={isImporting} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3">
          {post.permalink ? (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              View on Threads
              <ArrowSquareOut weight="bold" className="size-4" />
            </a>
          ) : null}
          <Link
            href={`/dashboard/create/scanner?text=${encodeURIComponent(text || "")}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Scan this post
            <MagnifyingGlass weight="bold" className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
