"use client";

/* Signed Threads CDN thumbnails are short-lived; plain img avoids caching them. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChatCircle,
  Eye,
  Heart,
  Image as ImageIcon,
  LinkSimple,
  NoteBlank,
  SortAscending,
  SortDescending,
  SquaresFour,
  TextT,
  VideoCamera,
} from "@phosphor-icons/react";

import { EmptyState } from "@/components/ui/empty-state";
import { LibraryOverview } from "./library-overview";
import { Pagination } from "./pagination";
import { PostDetail } from "./post-detail";
import { formatNumber } from "@/lib/engagement-prediction";
import { getPostsEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";
import { POST_MEDIA_LABELS, type StoredPostMediaType } from "@/lib/post-media-type";
import type { PostRow } from "@/lib/post-row";
import type { PostsOverview } from "@/lib/posts-overview";
import { getPostsPageRange } from "@/lib/posts-pagination";
import type { VelocityResult } from "@/lib/velocity-scoring";
import { computeNormalizedWES } from "@/lib/weighted-engagement";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "published_at", label: "Latest" },
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
  { value: "replies", label: "Replies" },
  { value: "engagement_rate", label: "Engagement rate" },
] as const;

const MEDIA_GLYPHS: Record<string, typeof TextT> = {
  TEXT: TextT,
  IMAGE: ImageIcon,
  VIDEO: VideoCamera,
  CAROUSEL: SquaresFour,
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function mediaLabel(mediaType: string): string {
  return POST_MEDIA_LABELS[mediaType as StoredPostMediaType] ?? mediaType;
}

function Thumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex size-full items-center justify-center bg-paper-2 text-ink-4">
        <ImageIcon weight="regular" className="size-4" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function PostListItem({
  post,
  isSelected,
  onSelect,
}: {
  post: PostRow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Glyph = MEDIA_GLYPHS[post.media_type] ?? TextT;
  const thumb = post.thumbnail_url ?? post.media_url;
  const wes = computeNormalizedWES(post);

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
      <span className="mt-0.5 size-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line bg-paper-2">
        {thumb ? (
          <Thumb src={thumb} alt="" />
        ) : post.link_attachment_url ? (
          <span className="flex size-full items-center justify-center text-ink-4">
            <LinkSimple weight="bold" className="size-4" />
          </span>
        ) : (
          <span className="flex size-full items-center justify-center text-ink-4">
            <Glyph weight="regular" className="size-4" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
          <time dateTime={post.published_at}>{formatShortDate(post.published_at)}</time>
          <span aria-hidden="true">·</span>
          <span>{mediaLabel(post.media_type)}</span>
          {post.link_attachment_url ? (
            <LinkSimple weight="bold" className="size-3" />
          ) : null}
          {post.media_type !== "TEXT" ? (
            <Glyph weight="regular" className="size-3" />
          ) : null}
        </span>

        <span className="mt-1 line-clamp-2 text-sm leading-snug">
          {post.text_preview || (
            <span className="text-ink-3">
              {post.media_type === "VIDEO" ? "Video post" : "Media post"}
            </span>
          )}
        </span>

        <span className="mt-1.5 flex items-center gap-3 font-mono text-[10px] tabular-nums text-ink-3">
          <span className="inline-flex items-center gap-0.5">
            <Eye weight="regular" className="size-3" />
            {formatNumber(post.views)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Heart weight="regular" className="size-3" />
            {formatNumber(post.likes)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <ChatCircle weight="regular" className="size-3" />
            {formatNumber(post.replies)}
          </span>
          <span className="ml-auto">{post.engagement_rate.toFixed(1)}%</span>
          <span className="text-ink-4">WES {wes.toFixed(2)}</span>
        </span>
      </span>
    </button>
  );
}

function MediaTile({
  post,
  isSelected,
  onSelect,
}: {
  post: PostRow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const thumb = post.thumbnail_url ?? post.media_url;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? "true" : undefined}
      aria-label={`Open ${mediaLabel(post.media_type)} post from ${formatShortDate(post.published_at)}`}
      className={cn(
        "group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-sm)] border bg-paper-2 transition-colors",
        isSelected
          ? "border-foreground shadow-[0_0_0_1px_var(--foreground)]"
          : "border-border hover:border-line-strong",
      )}
    >
      <Thumb src={thumb} alt={post.text_preview ?? "Media post"} />

      <span className="absolute left-1.5 top-1.5 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-foreground/70 p-1 text-background">
        {post.media_type === "VIDEO" ? (
          <VideoCamera weight="fill" className="size-3" />
        ) : post.media_type === "CAROUSEL" ? (
          <SquaresFour weight="fill" className="size-3" />
        ) : (
          <ImageIcon weight="fill" className="size-3" />
        )}
      </span>

      <span className="absolute bottom-1.5 right-1.5 rounded-[var(--radius-sm)] bg-foreground/70 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-background">
        {post.engagement_rate.toFixed(1)}%
      </span>

      <span className="pointer-events-none absolute inset-0 bg-foreground/0 transition-colors group-hover:bg-foreground/10" />
    </button>
  );
}

export function PostsLibrary({
  posts,
  username,
  currentPage,
  totalCount,
  totalPages,
  sortBy,
  sortOrder,
  hasFilters,
  isImporting,
  velocityMap,
  overview,
  initialSelectedId,
  listKey,
  mode,
}: {
  posts: PostRow[];
  username: string;
  currentPage: number;
  totalCount: number;
  totalPages: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  hasFilters: boolean;
  isImporting: boolean;
  velocityMap: Record<string, VelocityResult>;
  overview: PostsOverview | null;
  initialSelectedId: string | null;
  listKey: string;
  mode: "list" | "grid";
}) {
  const router = useRouter();
  const [selectionKey, setSelectionKey] = useState(listKey);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  if (selectionKey !== listKey) {
    setSelectionKey(listKey);
    setSelectedId(initialSelectedId);
  }

  const selectedPost = posts.find((post) => post.id === selectedId) ?? null;
  const visibleRange = getPostsPageRange({
    currentPage,
    totalCount,
    pageItemCount: posts.length,
  });

  function selectPost(postId: string | null) {
    setSelectedId(postId);
    const params = new URLSearchParams(window.location.search);
    if (postId) {
      params.set("post", postId);
    } else {
      params.delete("post");
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }

  function updateSort(nextSort: string, nextOrder: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("sort", nextSort);
    params.set("order", nextOrder);
    params.delete("page");
    params.delete("post");
    router.push(`${window.location.pathname}?${params.toString()}`);
  }

  function clearFilters() {
    const params = new URLSearchParams(window.location.search);
    params.delete("types");
    params.delete("from");
    params.delete("to");
    params.delete("page");
    params.delete("post");
    const query = params.toString();
    router.push(
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }

  const emptyStateCopy = getPostsEmptyStateCopy(isImporting);

  return (
    <>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground pb-2">
            <div>
              <p className="eyebrow">
                {mode === "grid" ? "Media library" : "Post list"}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {visibleRange
                  ? `Showing ${visibleRange.start}–${visibleRange.end} of ${totalCount.toLocaleString()}`
                  : `${totalCount.toLocaleString()} total`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="library-sort" className="sr-only">
                Sort posts
              </label>
              <select
                id="library-sort"
                value={sortBy}
                onChange={(event) =>
                  updateSort(event.target.value, sortOrder)
                }
                className="h-8 rounded-[var(--radius-sm)] border border-input-border bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  updateSort(sortBy, sortOrder === "desc" ? "asc" : "desc")
                }
                aria-label={
                  sortOrder === "desc"
                    ? "Sort ascending"
                    : "Sort descending"
                }
                title={
                  sortOrder === "desc" ? "Descending" : "Ascending"
                }
                className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-input-border bg-card text-ink-3 transition-colors hover:text-foreground"
              >
                {sortOrder === "desc" ? (
                  <SortDescending weight="bold" className="size-4" />
                ) : (
                  <SortAscending weight="bold" className="size-4" />
                )}
              </button>
            </div>
          </div>

          {posts.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={<NoteBlank weight="bold" className="size-7" />}
                title="No posts match your filters"
                description="Try adjusting your date range or media type selection."
                action={{ label: "Clear filters", onClick: clearFilters }}
              />
            ) : (
              <EmptyState
                icon={<NoteBlank weight="bold" className="size-7" />}
                title={emptyStateCopy.title}
                description={emptyStateCopy.description}
              />
            )
          ) : mode === "grid" ? (
            <div className="grid grid-cols-3 gap-2 py-3 sm:grid-cols-4 lg:grid-cols-3">
              {posts.map((post) => (
                <MediaTile
                  key={post.id}
                  post={post}
                  isSelected={post.id === selectedId}
                  onSelect={() => selectPost(post.id === selectedId ? null : post.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
              {posts.map((post) => (
                <PostListItem
                  key={post.id}
                  post={post}
                  isSelected={post.id === selectedId}
                  onSelect={() => selectPost(post.id === selectedId ? null : post.id)}
                />
              ))}
            </div>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>

        <aside
          className={cn(
            "min-w-0",
            selectedPost
              ? "fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0 lg:pt-0"
              : "hidden lg:block",
          )}
        >
          <div className="sticky top-6">
            {selectedPost ? (
              <PostDetail
                post={selectedPost}
                username={username}
                isImporting={isImporting}
                velocity={velocityMap[selectedPost.id]}
                onClose={() => selectPost(null)}
              />
            ) : overview ? (
              <LibraryOverview overview={overview} />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-border bg-card p-6 text-sm text-ink-3">
                Select a post to see its full text and metrics.
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
