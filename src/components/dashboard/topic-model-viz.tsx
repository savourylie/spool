"use client";

import { useState, useMemo, useCallback } from "react";
import { TreeStructure, X, Eye, ChatCircle, TrendUp } from "@phosphor-icons/react";
import { Treemap, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import type { TopicModelCluster } from "@/lib/topic-model";

interface TopicModelVizProps {
  clusters: TopicModelCluster[];
  totalPosts: number;
  isLoading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Custom treemap cell renderer                                       */
/* ------------------------------------------------------------------ */

interface TreemapCellProps {
  // Injected by Recharts cloneElement
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  color?: string;
  avgEngagement?: number;
  postCount?: number;
  // Passed explicitly
  selectedTopic: string | null;
  onSelect: (name: string) => void;
}

function TreemapCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = "",
  color = "",
  avgEngagement = 0,
  postCount = 0,
  selectedTopic,
  onSelect,
}: TreemapCellProps) {
  const isActive = selectedTopic === name;
  const showLabel = width > 60 && height > 40;
  const showStats = width > 80 && height > 55;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={color}
        stroke={isActive ? "var(--foreground)" : "var(--card)"}
        strokeWidth={isActive ? 3 : 2}
        className="cursor-pointer transition-opacity hover:opacity-90"
        onClick={() => onSelect(name)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(name);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`${name}: ${postCount} posts, ${avgEngagement.toFixed(1)}% engagement`}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showStats ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          className="pointer-events-none text-sm font-bold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {name}
        </text>
      )}
      {showStats && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.85)"
          className="pointer-events-none text-xs"
        >
          {postCount} posts &middot; {avgEngagement.toFixed(1)}% eng
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail panel                                                       */
/* ------------------------------------------------------------------ */

function TopicDetailPanel({
  cluster,
  onClose,
}: {
  cluster: TopicModelCluster;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border-2 border-foreground bg-muted/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-block size-3 rounded-full"
            style={{ backgroundColor: cluster.color }}
            aria-hidden="true"
          />
          <h4 className="font-heading text-base font-bold">{cluster.name}</h4>
          <ConfidenceBadge sample={cluster.postCount} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-full border-2 border-foreground bg-card transition-all duration-200 hover:bg-muted"
          aria-label="Close detail panel"
        >
          <X weight="bold" className="size-4" />
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-card p-2">
          <Eye weight="bold" className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Avg Views</p>
            <p className="text-sm font-bold">{Math.round(cluster.avgViews).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-card p-2">
          <ChatCircle weight="bold" className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Avg Replies</p>
            <p className="text-sm font-bold">{cluster.avgReplies.toFixed(1)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-card p-2">
          <TrendUp weight="bold" className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Avg WES</p>
            <p className="text-sm font-bold">{cluster.avgWes.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Top posts */}
      {cluster.topPosts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Top Posts
          </p>
          <div className="space-y-2">
            {cluster.topPosts.map((post, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] bg-card p-2 text-sm"
              >
                <p className="min-w-0 flex-1 truncate text-muted-foreground">
                  {post.text_preview || "No preview"}
                </p>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span>{post.views.toLocaleString()} views</span>
                  <span className="font-medium text-foreground">
                    WES {post.wes.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function TopicModelVizSkeleton() {
  return (
    <div className="grid h-[280px] grid-cols-4 grid-rows-2 gap-2">
      <div className="col-span-2 row-span-2 animate-pulse rounded-[var(--radius-md)] bg-muted" />
      <div className="col-span-2 animate-pulse rounded-[var(--radius-md)] bg-muted" />
      <div className="animate-pulse rounded-[var(--radius-md)] bg-muted" />
      <div className="animate-pulse rounded-[var(--radius-md)] bg-muted" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function TopicModelViz({
  clusters,
  totalPosts,
  isLoading,
}: TopicModelVizProps) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const treemapData = useMemo(
    () =>
      clusters.map((c) => ({
        name: c.name,
        size: c.postCount,
        color: c.color,
        avgEngagement: c.avgEngagement,
        postCount: c.postCount,
      })),
    [clusters],
  );

  const selectedCluster = useMemo(
    () => clusters.find((c) => c.name === selectedTopic) ?? null,
    [clusters, selectedTopic],
  );

  const handleSelect = useCallback(
    (name: string) => {
      setSelectedTopic((prev) => (prev === name ? null : name));
    },
    [],
  );

  const instant = { duration: 0 };
  const spring = { type: "spring" as const, stiffness: 300, damping: 25 };

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="primary">
        <TreeStructure weight="bold" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Topic Clusters</StickerCardTitle>
        <StickerCardDescription>
          {totalPosts > 0
            ? `${totalPosts} posts across ${clusters.length} topic${clusters.length !== 1 ? "s" : ""}`
            : "Visualize your content by topic"}
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        {isLoading ? (
          <TopicModelVizSkeleton />
        ) : clusters.length === 0 ? (
          <EmptyState
            icon={<TreeStructure weight="bold" className="size-7" />}
            iconColor="primary"
            title="No topic clusters yet"
            description="Topic clusters will appear once your posts have topic tags assigned."
          />
        ) : (
          <>
            <div
              className="h-[280px] w-full"
              role="img"
              aria-label={`Topic treemap with ${clusters.length} clusters. Largest: ${clusters[0]?.name} with ${clusters[0]?.postCount} posts`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="size"
                  content={
                    <TreemapCell
                      selectedTopic={selectedTopic}
                      onSelect={handleSelect}
                    />
                  }
                />
              </ResponsiveContainer>
            </div>

            {/* Detail panel */}
            <AnimatePresence initial={false}>
              {selectedCluster && (
                <motion.div
                  initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={shouldReduceMotion ? instant : spring}
                  style={{ overflow: "hidden" }}
                >
                  <TopicDetailPanel
                    cluster={selectedCluster}
                    onClose={() => setSelectedTopic(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </StickerCardContent>
    </StickerCard>
  );
}
