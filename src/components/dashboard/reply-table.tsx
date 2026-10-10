import Link from "next/link";
import { ArrowSquareOut, ChatCircleText } from "@phosphor-icons/react/dist/ssr";

import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/dashboard/pagination";
import { ReplyReviewButton } from "@/components/dashboard/reply-review-button";
import { getPostsPageRange } from "@/lib/posts-pagination";
import { cn } from "@/lib/utils";

export interface ReplyAuditRow {
  id: string;
  text: string | null;
  permalink: string | null;
  replied_at: string;
  risk_level: string;
  risk_categories: string[];
  risk_summary: string | null;
  review_status: string;
}

interface ReplyTableProps {
  replies: ReplyAuditRow[];
  currentPage: number;
  totalCount: number;
  totalPages: number;
  hasFilters?: boolean;
}

const riskClassName: Record<string, string> = {
  high: "border-destructive bg-destructive/10 text-destructive",
  medium: "border-tertiary bg-tertiary/10 text-foreground",
  low: "border-secondary bg-secondary/10 text-foreground",
  unknown: "border-line-strong bg-muted text-muted-foreground",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-semibold capitalize",
        riskClassName[level] ?? riskClassName.unknown,
      )}
    >
      {level}
    </span>
  );
}

export function ReplyTable({
  replies,
  currentPage,
  totalCount,
  totalPages,
  hasFilters,
}: ReplyTableProps) {
  const visibleRange = getPostsPageRange({
    currentPage,
    totalCount,
    pageItemCount: replies.length,
  });

  return (
    <div>
      {visibleRange && (
        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Showing {visibleRange.start}-{visibleRange.end} of{" "}
            {totalCount.toLocaleString()} replies
          </p>
          {totalPages > 1 && (
            <p className="hidden sm:block">
              Page {currentPage} of {totalPages}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground">
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reply
              </th>
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Risk
              </th>
              <th className="px-3 py-3 text-left font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reason
              </th>
              <th className="px-3 py-3 text-right font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Date
              </th>
              <th className="px-3 py-3 text-right font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Link
              </th>
            </tr>
          </thead>
          <tbody>
            {replies.map((reply, index) => (
              <tr
                key={reply.id}
                className={cn(
                  "border-b border-border align-top",
                  index % 2 === 1 ? "bg-muted" : "bg-white",
                )}
              >
                <td className="max-w-[420px] px-3 py-3">
                  <p className="line-clamp-3 whitespace-pre-wrap">
                    {reply.text || "No text captured"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">
                      {reply.review_status.replace("_", " ")}
                    </span>
                    {reply.risk_categories.length > 0 ? (
                      <span>{reply.risk_categories.join(", ")}</span>
                    ) : null}
                    <ReplyReviewButton
                      replyId={reply.id}
                      reviewStatus={reply.review_status}
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <RiskBadge level={reply.risk_level} />
                </td>
                <td className="max-w-[320px] px-3 py-3 text-muted-foreground">
                  {reply.risk_summary ?? "Not analyzed yet."}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-muted-foreground">
                  <time dateTime={reply.replied_at}>
                    {formatDate(reply.replied_at)}
                  </time>
                </td>
                <td className="px-3 py-3 text-right">
                  {reply.permalink ? (
                    <Link
                      href={reply.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Open
                      <ArrowSquareOut weight="bold" className="size-3.5" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {replies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3">
                  <EmptyState
                    icon={<ChatCircleText weight="bold" className="size-7" />}
                    iconColor={hasFilters ? "tertiary" : "primary"}
                    title={hasFilters ? "No replies match your filters" : "No replies synced yet"}
                    description={
                      hasFilters
                        ? "Try adjusting your filters or search query."
                        : "Sync your Threads replies to start reviewing public-image risk."
                    }
                  />
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
