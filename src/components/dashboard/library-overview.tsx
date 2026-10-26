import { ArrowSquareOut } from "@phosphor-icons/react";
import { formatNumber } from "@/lib/engagement-prediction";
import { POST_MEDIA_LABELS, type StoredPostMediaType } from "@/lib/post-media-type";
import type { PostsOverview } from "@/lib/posts-overview";

function mediaLabel(mediaType: string): string {
  return POST_MEDIA_LABELS[mediaType as StoredPostMediaType] ?? mediaType;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-card px-4 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-mono text-2xl font-medium tabular-nums tracking-tight">
        {value}
      </div>
      {note ? <div className="mt-0.5 text-[11px] text-ink-3">{note}</div> : null}
    </div>
  );
}

export function LibraryOverview({ overview }: { overview: PostsOverview }) {
  const maxRate = Math.max(
    ...overview.mediaBreakdown.map((entry) => entry.engagementRate),
    0.01,
  );
  const bestFormat = [...overview.mediaBreakdown].sort(
    (a, b) => b.engagementRate - a.engagementRate,
  )[0];

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <div className="eyebrow">Library pulse</div>
        <h2 className="mt-1 font-heading text-xl tracking-[-0.02em]">
          The archive at a glance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a post on the left to read it in full, or start with what is
          already working.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        <Stat label="Posts" value={overview.totalPosts.toLocaleString()} />
        <Stat label="Views" value={formatNumber(overview.totalViews)} />
        <Stat
          label="Interactions"
          value={formatNumber(overview.totalInteractions)}
          note="Likes, replies, reposts, quotes, shares"
        />
        <Stat
          label="Engagement rate"
          value={`${overview.engagementRate.toFixed(2)}%`}
          note="Interactions ÷ views"
        />
      </div>

      {overview.mediaBreakdown.length > 0 ? (
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="eyebrow">Average engagement by format</div>
            {bestFormat ? (
              <span className="text-xs text-ink-3">
                Best: <span className="font-medium text-foreground">{mediaLabel(bestFormat.mediaType)}</span>
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-3">
            {overview.mediaBreakdown.map((entry) => (
              <div key={entry.mediaType}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium">{mediaLabel(entry.mediaType)}</span>
                  <span className="font-mono tabular-nums text-ink-3">
                    {entry.engagementRate.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-paper-3">
                  <div
                    className="h-full bg-foreground"
                    style={{
                      width: `${Math.max(
                        (entry.engagementRate / maxRate) * 100,
                        entry.engagementRate > 0 ? 3 : 0,
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
                  {entry.posts.toLocaleString()} posts · {formatNumber(entry.avgViews)} avg views
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {overview.topPost ? (
        <div className="border-b border-border px-4 py-4">
          <div className="eyebrow">Most viewed</div>
          <p className="mt-1 line-clamp-2 text-sm">
            {overview.topPost.textPreview || "Media post"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] tabular-nums text-ink-3">
              {formatNumber(overview.topPost.views)} views ·{" "}
              {mediaLabel(overview.topPost.mediaType)} ·{" "}
              {formatDate(overview.topPost.publishedAt)}
            </span>
            {overview.topPost.permalink ? (
              <a
                href={overview.topPost.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                Open
                <ArrowSquareOut weight="bold" className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
        Select a post to inspect its full text, media and momentum
      </div>
    </div>
  );
}
