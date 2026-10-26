"use client";

/* Threads CDN thumbnails are signed and expire; plain img is intentional. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  ChatCircleText,
  CheckCircle,
  ShieldCheck,
  ShieldWarning,
  X,
} from "@phosphor-icons/react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "./pagination";
import { PostLinkCard } from "./post-link-card";
import { PostMedia } from "./post-media";
import { ReplyReviewButton } from "./reply-review-button";
import { formatNumber } from "@/lib/engagement-prediction";
import { getPostsPageRange } from "@/lib/posts-pagination";
import { cn } from "@/lib/utils";

export interface ReplyLibraryRow {
  id: string;
  text: string | null;
  permalink: string | null;
  replied_at: string;
  risk_level: string;
  risk_categories: string[];
  risk_summary: string | null;
  review_status: string;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  alt_text: string | null;
  link_attachment_url: string | null;
  shortcode: string | null;
}

const RISK_STYLES: Record<
  string,
  { dot: string; chip: string; text: string; label: string }
> = {
  high: {
    dot: "bg-neg",
    chip: "border-neg/30 bg-neg-soft text-neg",
    text: "text-neg",
    label: "High risk",
  },
  medium: {
    dot: "bg-warn",
    chip: "border-warn/30 bg-warn-soft text-warn",
    text: "text-warn",
    label: "Medium risk",
  },
  low: {
    dot: "bg-pos",
    chip: "border-pos/30 bg-pos-soft text-pos",
    text: "text-pos",
    label: "Low risk",
  },
  unknown: {
    dot: "bg-ink-4",
    chip: "border-line bg-paper-2 text-ink-3",
    text: "text-ink-4",
    label: "Not analyzed",
  },
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RiskChip({ level }: { level: string }) {
  const style = RISK_STYLES[level] ?? RISK_STYLES.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em]",
        style.chip,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

function ReplyListItem({
  reply,
  isSelected,
  onSelect,
}: {
  reply: ReplyLibraryRow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const risk = RISK_STYLES[reply.risk_level] ?? RISK_STYLES.unknown;
  const thumb = reply.thumbnail_url ?? reply.media_url;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "group flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors last:border-b-0",
        isSelected
          ? "bg-paper-2 shadow-[inset_2px_0_0_0_var(--foreground)]"
          : "hover:bg-paper-2/60",
      )}
    >
      {thumb ? (
        <span className="mt-0.5 size-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line bg-paper-2">
          <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
        </span>
      ) : (
        <span className="mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-paper-2 text-ink-4">
          <ChatCircleText weight="regular" className="size-4" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
          <time dateTime={reply.replied_at}>{formatShortDate(reply.replied_at)}</time>
          <span aria-hidden="true">·</span>
          <span className={cn("inline-flex items-center gap-1", risk.text)}>
            <span className={cn("size-1.5 rounded-full", risk.dot)} />
            {risk.label}
          </span>
        </span>
        <span className="mt-1 line-clamp-2 text-sm leading-snug">
          {reply.text || <span className="text-ink-3">No text captured</span>}
        </span>
        <span className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-ink-3">
          {reply.review_status === "reviewed" ? (
            <span className="inline-flex items-center gap-0.5 text-pos">
              <CheckCircle weight="fill" className="size-3" />
              Reviewed
            </span>
          ) : (
            <span>Needs review</span>
          )}
          {reply.risk_categories.length > 0 ? (
            <span className="truncate text-ink-4">
              {reply.risk_categories.join(" · ")}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function ReplyDetail({
  reply,
  onClose,
}: {
  reply: ReplyLibraryRow;
  onClose?: () => void;
}) {
  const auditHref = reply.text
    ? `/dashboard/replies?q=${encodeURIComponent(reply.text.slice(0, 60))}`
    : "/dashboard/replies";

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="eyebrow">Reply · Threads</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-3">
            <time dateTime={reply.replied_at}>{formatFullDate(reply.replied_at)}</time>
            {reply.shortcode ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{reply.shortcode}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {reply.permalink ? (
            <a
              href={reply.permalink}
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
              aria-label="Close reply detail"
              className="rounded-[var(--radius-sm)] p-1.5 text-ink-3 transition-colors hover:bg-paper-2 hover:text-foreground"
            >
              <X weight="bold" className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-4 py-4">
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {reply.text || "No text captured for this reply."}
        </p>

        <PostMedia
          post={{
            id: reply.id,
            media_type: reply.media_type ?? "TEXT",
            media_url: reply.media_url,
            thumbnail_url: reply.thumbnail_url,
            alt_text: reply.alt_text,
          }}
          className="mt-4"
        />

        {reply.link_attachment_url ? (
          <PostLinkCard url={reply.link_attachment_url} />
        ) : null}

        <div className="mt-5 rounded-[var(--radius-sm)] border border-border bg-paper-2/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              {reply.risk_level === "high" || reply.risk_level === "medium" ? (
                <ShieldWarning weight="bold" className="size-4 text-warn" />
              ) : (
                <ShieldCheck weight="bold" className="size-4 text-pos" />
              )}
              <span className="eyebrow">Reputation review</span>
            </span>
            <RiskChip level={reply.risk_level} />
          </div>

          <p className="mt-2 text-sm text-ink-2">
            {reply.risk_summary ?? "This reply has not been analyzed yet."}
          </p>

          {reply.risk_categories.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {reply.risk_categories.map((category) => (
                <span
                  key={category}
                  className="inline-flex rounded-[var(--radius-sm)] border border-line bg-card px-1.5 py-0.5 text-[10px] text-ink-3"
                >
                  {category}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-3">
              {reply.review_status === "reviewed"
                ? "Marked as reviewed"
                : "Waiting for your review"}
            </span>
            <ReplyReviewButton
              replyId={reply.id}
              reviewStatus={reply.review_status}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3">
          <Link
            href={auditHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Open in reply review
          </Link>
          {reply.permalink ? (
            <a
              href={reply.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              View on Threads
              <ArrowSquareOut weight="bold" className="size-4" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function RepliesLibrary({
  replies,
  currentPage,
  totalCount,
  totalPages,
  hasFilters,
  initialSelectedId,
  listKey,
}: {
  replies: ReplyLibraryRow[];
  currentPage: number;
  totalCount: number;
  totalPages: number;
  hasFilters: boolean;
  initialSelectedId: string | null;
  listKey: string;
}) {
  const [selectionKey, setSelectionKey] = useState(listKey);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  if (selectionKey !== listKey) {
    setSelectionKey(listKey);
    setSelectedId(initialSelectedId);
  }

  const selectedReply = replies.find((reply) => reply.id === selectedId) ?? null;
  const visibleRange = getPostsPageRange({
    currentPage,
    totalCount,
    pageItemCount: replies.length,
  });

  function selectReply(replyId: string | null) {
    setSelectedId(replyId);
    const params = new URLSearchParams(window.location.search);
    if (replyId) {
      params.set("reply", replyId);
    } else {
      params.delete("reply");
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }

  function clearFilters() {
    const params = new URLSearchParams(window.location.search);
    params.delete("q");
    params.delete("risk");
    params.delete("status");
    params.delete("from");
    params.delete("to");
    params.delete("page");
    params.delete("reply");
    const query = params.toString();
    window.location.assign(
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }

  return (
    <>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground pb-2">
            <div>
              <p className="eyebrow">Authored replies</p>
              <p className="mt-1 text-xs text-ink-3">
                {visibleRange
                  ? `Showing ${visibleRange.start}–${visibleRange.end} of ${totalCount.toLocaleString()}`
                  : `${totalCount.toLocaleString()} total`}
              </p>
            </div>
            <Link
              href="/dashboard/replies"
              className="text-xs font-medium text-accent hover:underline"
            >
              Full reply review →
            </Link>
          </div>

          {replies.length === 0 ? (
            <EmptyState
              icon={<ChatCircleText weight="bold" className="size-7" />}
              title={hasFilters ? "No replies match your filters" : "No replies synced yet"}
              description={
                hasFilters
                  ? "Try adjusting your search or filters."
                  : "Use Sync replies to pull your recent Threads replies into the library."
              }
              action={
                hasFilters
                  ? { label: "Clear filters", onClick: clearFilters }
                  : undefined
              }
            />
          ) : (
            <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
              {replies.map((reply) => (
                <ReplyListItem
                  key={reply.id}
                  reply={reply}
                  isSelected={reply.id === selectedId}
                  onSelect={() => selectReply(reply.id === selectedId ? null : reply.id)}
                />
              ))}
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>

        <aside
          className={cn(
            "min-w-0",
            selectedReply
              ? "fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0 lg:pt-0"
              : "hidden lg:block",
          )}
        >
          <div className="sticky top-6">
            {selectedReply ? (
              <ReplyDetail reply={selectedReply} onClose={() => selectReply(null)} />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-border bg-card">
                <div className="border-b border-border px-4 py-4">
                  <div className="eyebrow">Reply review</div>
                  <h2 className="mt-1 font-heading text-xl tracking-[-0.02em]">
                    Your side of the conversation
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a reply to read it in full and see the reputation
                    review.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-card px-4 py-4">
                    <div className="eyebrow">Replies</div>
                    <div className="mt-1 font-mono text-2xl tabular-nums">
                      {totalCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-card px-4 py-4">
                    <div className="eyebrow">Flagged</div>
                    <div className="mt-1 font-mono text-2xl tabular-nums">
                      {formatNumber(
                        replies.filter(
                          (reply) =>
                            reply.risk_level === "high" ||
                            reply.risk_level === "medium",
                        ).length,
                      )}
                      <span className="ml-1 text-sm text-ink-3">on this page</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
                  Risk labels are advisory, not moderation decisions
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
