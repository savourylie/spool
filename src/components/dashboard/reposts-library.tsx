"use client";

import { useState } from "react";
import {
  ArrowSquareOut,
  CaretRight,
  Repeat,
  X,
} from "@phosphor-icons/react";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "./pagination";
import { getPostsPageRange } from "@/lib/posts-pagination";
import { cn } from "@/lib/utils";

export interface RepostLibraryRow {
  id: string;
  permalink: string | null;
  shortcode: string | null;
  reposted_at: string;
}

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

function RepostDetail({
  repost,
  onClose,
}: {
  repost: RepostLibraryRow;
  onClose?: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="eyebrow">Repost · Threads</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-3">
            <time dateTime={repost.reposted_at}>
              {formatFullDate(repost.reposted_at)}
            </time>
            {repost.shortcode ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{repost.shortcode}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {repost.permalink ? (
            <a
              href={repost.permalink}
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
              aria-label="Close repost detail"
              className="rounded-[var(--radius-sm)] p-1.5 text-ink-3 transition-colors hover:bg-paper-2 hover:text-foreground"
            >
              <X weight="bold" className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-4 py-5">
        <div className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-paper-2 text-ink-3">
          <Repeat weight="bold" className="size-5" />
        </div>
        <h3 className="mt-3 font-heading text-lg tracking-[-0.015em]">
          You reposted this thread
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Threads only exposes a repost reference through the API — no text,
          media or metrics for the original post. Open it on Threads to read the
          full conversation.
        </p>

        {repost.permalink ? (
          <a
            href={repost.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            View repost on Threads
            <ArrowSquareOut weight="bold" className="size-4" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function RepostsLibrary({
  reposts,
  currentPage,
  totalCount,
  totalPages,
  initialSelectedId,
  listKey,
}: {
  reposts: RepostLibraryRow[];
  currentPage: number;
  totalCount: number;
  totalPages: number;
  initialSelectedId: string | null;
  listKey: string;
}) {
  const [selectionKey, setSelectionKey] = useState(listKey);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  if (selectionKey !== listKey) {
    setSelectionKey(listKey);
    setSelectedId(initialSelectedId);
  }

  const selectedRepost = reposts.find((repost) => repost.id === selectedId) ?? null;
  const visibleRange = getPostsPageRange({
    currentPage,
    totalCount,
    pageItemCount: reposts.length,
  });

  function selectRepost(repostId: string | null) {
    setSelectedId(repostId);
    const params = new URLSearchParams(window.location.search);
    if (repostId) {
      params.set("repost", repostId);
    } else {
      params.delete("repost");
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }

  return (
    <>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground pb-2">
            <div>
              <p className="eyebrow">Repost history</p>
              <p className="mt-1 text-xs text-ink-3">
                {visibleRange
                  ? `Showing ${visibleRange.start}–${visibleRange.end} of ${totalCount.toLocaleString()}`
                  : `${totalCount.toLocaleString()} total`}
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
              Reference only
            </span>
          </div>

          {reposts.length === 0 ? (
            <EmptyState
              icon={<Repeat weight="bold" className="size-7" />}
              title="No reposts yet"
              description="Threads posts you repost will show up here after the next sync."
            />
          ) : (
            <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
              {reposts.map((repost) => (
                <button
                  key={repost.id}
                  type="button"
                  onClick={() => selectRepost(repost.id === selectedId ? null : repost.id)}
                  aria-current={repost.id === selectedId ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border px-3 py-3.5 text-left transition-colors last:border-b-0",
                    repost.id === selectedId
                      ? "bg-paper-2 shadow-[inset_2px_0_0_0_var(--foreground)]"
                      : "hover:bg-paper-2/60",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-line bg-paper-2 text-ink-3">
                    <Repeat weight="bold" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
                      <time dateTime={repost.reposted_at}>
                        {formatShortDate(repost.reposted_at)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>Reposted</span>
                    </span>
                    <span className="mt-1 block truncate text-sm">
                      {repost.shortcode
                        ? `threads.com · ${repost.shortcode}`
                        : "Open on Threads"}
                    </span>
                  </span>
                  <CaretRight
                    weight="bold"
                    className="size-3.5 shrink-0 text-ink-4"
                  />
                </button>
              ))}
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>

        <aside
          className={cn(
            "min-w-0",
            selectedRepost
              ? "fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0 lg:pt-0"
              : "hidden lg:block",
          )}
        >
          <div className="sticky top-6">
            {selectedRepost ? (
              <RepostDetail
                repost={selectedRepost}
                onClose={() => selectRepost(null)}
              />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-border bg-card">
                <div className="border-b border-border px-4 py-4">
                  <div className="eyebrow">Reposts</div>
                  <h2 className="mt-1 font-heading text-xl tracking-[-0.02em]">
                    What you amplified
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A record of the threads you reposted, newest first.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-card px-4 py-4">
                    <div className="eyebrow">Reposts</div>
                    <div className="mt-1 font-mono text-2xl tabular-nums">
                      {totalCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-card px-4 py-4">
                    <div className="eyebrow">Latest</div>
                    <div className="mt-1 font-mono text-2xl tabular-nums">
                      {reposts[0] ? formatShortDate(reposts[0].reposted_at) : "—"}
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 text-xs text-ink-3">
                  Threads does not return the reposted post&apos;s text or media
                  through its API, so each entry links back to Threads.
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
