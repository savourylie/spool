import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";

import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FreshnessLogCard } from "@/components/dashboard/freshness-log-card";
import { Pagination } from "@/components/dashboard/pagination";
import { PredictionReviewCard } from "@/components/dashboard/prediction-review-card";
import { RedVerdictsTable } from "@/components/dashboard/red-verdicts-table";
import { ReviewCumulativeStats } from "@/components/dashboard/review-cumulative-stats";
import {
  fetchRedFreshnessVerdicts,
  getFreshnessLogCounts,
} from "@/lib/freshness-log";
import {
  computeBandDistribution,
  computeBaselineTrend,
  fetchReviewedPredictionsPage,
} from "@/lib/prediction-reviews";
import {
  POSTS_PAGE_SIZE,
  getPostsTotalPages,
} from "@/lib/posts-pagination";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const metadata: Metadata = { title: "Reviews — Spool" };

export const dynamic = "force-dynamic";

const RED_VERDICT_FETCH_LIMIT = 50;
const FRESHNESS_WINDOW_DAYS = 30;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const userId = session.value;
  const now = new Date();
  const nowMs = now.getTime();

  let pageResult: Awaited<ReturnType<typeof fetchReviewedPredictionsPage>>;
  let distribution: Awaited<ReturnType<typeof computeBandDistribution>>;
  let trend: Awaited<ReturnType<typeof computeBaselineTrend>>;
  let freshnessCounts: Awaited<ReturnType<typeof getFreshnessLogCounts>>;
  let redVerdicts: Awaited<ReturnType<typeof fetchRedFreshnessVerdicts>>;

  try {
    [pageResult, distribution, trend, freshnessCounts, redVerdicts] =
      await Promise.all([
        fetchReviewedPredictionsPage({
          userId,
          page,
          pageSize: POSTS_PAGE_SIZE,
        }),
        computeBandDistribution(userId),
        computeBaselineTrend(userId, now),
        getFreshnessLogCounts(userId, now, FRESHNESS_WINDOW_DAYS),
        fetchRedFreshnessVerdicts(
          userId,
          { windowDays: FRESHNESS_WINDOW_DAYS, limit: RED_VERDICT_FETCH_LIMIT },
          now,
        ),
      ]);
  } catch {
    return <ErrorState description="We couldn't load your reviews right now." />;
  }

  const { rows, totalCount } = pageResult;
  const totalPages = getPostsTotalPages(totalCount);

  if (totalPages > 0 && page > totalPages) {
    redirect(`/dashboard/understand/reviews?page=${totalPages}`);
  }

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-heading text-3xl font-bold">Prediction Review</h1>
        <ConfidenceBadge sample={totalCount} />
      </div>
      <p className="mt-2 text-muted-foreground">
        See how your predicted ranges compared to actual performance.
      </p>

      {totalCount === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<ClockCounterClockwise weight="bold" className="size-7" />}
            iconColor="primary"
            title="No reviews yet"
            description="Your first review will appear here 24 hours after your next published post."
            action={{
              label: "Draft a post",
              href: "/dashboard/create/compose",
            }}
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <ReviewCumulativeStats distribution={distribution} trend={trend} />
          </div>

          <div className="mt-8">
            <h2 className="font-heading text-xl font-bold">Timeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Most recent reviews first. Click a narrative to expand.
            </p>
            <div className="mt-4 space-y-4">
              {rows.map((row) => (
                <PredictionReviewCard key={row.id} row={row} now={nowMs} />
              ))}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} />
          </div>
        </>
      )}

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-bold">Freshness log</h2>
          <Link
            href="/dashboard/create/compose"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Run a freshness check →
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Verdict breakdown for the last 30 days of topics you drafted or scanned.
        </p>
        <div className="mt-4">
          <FreshnessLogCard
            counts={freshnessCounts}
            windowLabel="Last 30 days"
            showReviewLink={false}
          />
          <RedVerdictsTable
            rows={redVerdicts}
            fetchLimit={RED_VERDICT_FETCH_LIMIT}
            now={nowMs}
          />
        </div>
      </section>
    </div>
  );
}
