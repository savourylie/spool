"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { CaretUp, CaretDown, TextT, Image, VideoCamera, SquaresFour, NoteBlank, FunnelSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "./pagination";
import { PostRowDetail } from "./post-row-detail";

export interface PostRow {
  id: string;
  media_type: string;
  text_preview: string | null;
  permalink: string | null;
  published_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  engagement_rate: number;
}

interface PostTableProps {
  posts: PostRow[];
  currentPage: number;
  totalPages: number;
  sortBy: string;
  sortOrder: string;
  hasFilters?: boolean;
}

const MEDIA_ICONS: Record<string, { icon: typeof TextT; color: string }> = {
  TEXT: { icon: TextT, color: "bg-accent" },
  IMAGE: { icon: Image, color: "bg-secondary" },
  VIDEO: { icon: VideoCamera, color: "bg-tertiary" },
  CAROUSEL: { icon: SquaresFour, color: "bg-quaternary" },
};

const COLUMNS = [
  { key: "text_preview", label: "Post", sortable: false },
  { key: "published_at", label: "Date", sortable: true },
  { key: "views", label: "Views", sortable: true },
  { key: "likes", label: "Likes", sortable: true },
  { key: "replies", label: "Replies", sortable: true },
  { key: "reposts", label: "Reposts", sortable: true },
  { key: "quotes", label: "Quotes", sortable: true },
  { key: "shares", label: "Shares", sortable: true },
  { key: "engagement_rate", label: "Eng. Rate", sortable: true },
] as const;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ClearFiltersButton({ pathname, searchParams }: { pathname: string; searchParams: URLSearchParams }) {
  const router = useRouter();

  function handleClear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("types");
    params.delete("from");
    params.delete("to");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClear}>
      Clear filters
    </Button>
  );
}

export function PostTable({ posts, currentPage, totalPages, sortBy, sortOrder, hasFilters }: PostTableProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mountedIds, setMountedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((postId: string) => {
    setExpandedId((prev) => {
      if (prev === postId) return null;
      setMountedIds((s) => {
        if (s.has(postId)) return s;
        const next = new Set(s);
        next.add(postId);
        return next;
      });
      return postId;
    });
  }, []);

  function sortHref(column: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", column);
    params.set("order", sortBy === column && sortOrder === "desc" ? "asc" : "desc");
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  // Find top engagement rate for accent highlighting
  const maxRate = Math.max(...posts.map((p) => p.engagement_rate), 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-foreground">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-3 text-left font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground",
                    col.key !== "text_preview" && "text-right"
                  )}
                >
                  {col.sortable ? (
                    <Link
                      href={sortHref(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {col.label}
                      {sortBy === col.key ? (
                        sortOrder === "asc" ? (
                          <CaretUp weight="bold" className="size-3" />
                        ) : (
                          <CaretDown weight="bold" className="size-3" />
                        )
                      ) : (
                        <CaretUp weight="regular" className="size-3 opacity-30" />
                      )}
                    </Link>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((post, i) => {
              const media = MEDIA_ICONS[post.media_type] ?? MEDIA_ICONS.TEXT;
              const Icon = media.icon;
              const isTopPerformer = maxRate > 0 && post.engagement_rate === maxRate;
              const isExpanded = expandedId === post.id;

              return (
                <React.Fragment key={post.id}>
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpand(post.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpand(post.id);
                      }
                    }}
                    className={cn(
                      "cursor-pointer transition-colors",
                      i % 2 === 1 ? "bg-muted" : "bg-white",
                      isExpanded ? "bg-accent/5" : "hover:bg-accent/5",
                      !isExpanded && "border-b border-border"
                    )}
                  >
                    <td className="px-3 py-3 max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex-shrink-0 inline-flex items-center justify-center size-7 rounded-full text-white",
                            media.color
                          )}
                        >
                          <Icon weight="fill" className="size-3.5" />
                        </span>
                        <span className="truncate" title={post.text_preview ?? undefined}>
                          {post.text_preview || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground">
                      {formatDate(post.published_at)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(post.views)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(post.likes)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(post.replies)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(post.reposts)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(post.quotes)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(post.shares)}</td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right tabular-nums font-bold",
                        isTopPerformer ? "text-accent" : ""
                      )}
                    >
                      {post.engagement_rate.toFixed(2)}%
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td colSpan={9} className="p-0">
                      <div
                        className="grid transition-[grid-template-rows] duration-300 [transition-timing-function:var(--ease-bounce)]"
                        style={{
                          gridTemplateRows: isExpanded ? "1fr" : "0fr",
                        }}
                      >
                        <div className="overflow-hidden">
                          {mountedIds.has(post.id) && <PostRowDetail post={post} />}
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            {posts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3">
                  {hasFilters ? (
                    <EmptyState
                      icon={<FunnelSimple weight="bold" className="size-7" />}
                      iconColor="tertiary"
                      title="No posts match your filters"
                      description="Try adjusting your date range or media type selection."
                      action={{
                        label: "Clear filters",
                        onClick: () => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.delete("types");
                          params.delete("from");
                          params.delete("to");
                          params.delete("page");
                          const qs = params.toString();
                          router.push(qs ? `${pathname}?${qs}` : pathname);
                        },
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={<NoteBlank weight="bold" className="size-7" />}
                      iconColor="primary"
                      title="No posts yet"
                      description="Connect your Threads account and run a backfill to see your post analytics here."
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
}
