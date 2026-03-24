"use client";

import { useState } from "react";
import { Lightning, ArrowSquareOut, X } from "@phosphor-icons/react";
import type { ReselectedPost } from "@/lib/reselection-detection";

function ReselectedPostItem({ post }: { post: ReselectedPost }) {
  const truncatedText = post.textPreview
    ? post.textPreview.length > 80
      ? post.textPreview.slice(0, 80) + "\u2026"
      : post.textPreview
    : "No text content";

  return (
    <div className="rounded-[var(--radius-sm)] bg-background/60 px-3 py-2">
      <p className="truncate text-sm font-medium">{truncatedText}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {post.deltaSummary}
      </p>
      {post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Engage with new comments to keep momentum
          <ArrowSquareOut weight="bold" className="size-3.5" />
        </a>
      )}
    </div>
  );
}

export function ReselectionAlert({ posts }: { posts: ReselectedPost[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || posts.length === 0) return null;

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border-2 border-accent/30 bg-accent/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <Lightning
          weight="bold"
          className="mt-0.5 size-5 shrink-0 text-accent"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Content gaining traction</p>
              <p className="text-sm text-muted-foreground">
                {posts.length === 1
                  ? "An older post is"
                  : `${posts.length} older posts are`}{" "}
                seeing renewed engagement.
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
              aria-label="Dismiss alert"
            >
              <X weight="bold" className="size-4" />
            </button>
          </div>
          <div
            className={
              posts.length > 2
                ? "max-h-[180px] space-y-2 overflow-y-auto pr-1"
                : "space-y-2"
            }
          >
            {posts.map((post) => (
              <ReselectedPostItem key={post.postId} post={post} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
