"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useBackfillJob } from "@/hooks/use-backfill-job";
import {
  BACKFILL_REFRESH_DELAY_MS,
  BACKFILL_SUCCESS_HIDE_DELAY_MS,
  createRefreshGate,
  createRefreshScheduler,
  getBackfillLastUpdatedAt,
  getBackfillPercentage,
  getBackfillStageLabel,
  getBackfillStaleMessage,
  type BackfillJob,
} from "@/lib/backfill-job";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatRelativeTime(dateString: string | null, now: number) {
  if (!dateString) return null;

  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return null;

  const diffSeconds = Math.round((timestamp - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return relativeTimeFormatter.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
}

function getProgressLabel(job: BackfillJob) {
  const processed = job.processed_posts ?? 0;

  if (job.total_posts && job.total_posts > 0) {
    return `${processed.toLocaleString()} of ${job.total_posts.toLocaleString()} posts imported`;
  }

  if (processed > 0) {
    return `${processed.toLocaleString()} posts imported so far`;
  }

  return "Fetching your Threads posts in the background";
}

export function DashboardBackfillBanner({
  initialJob,
}: {
  initialJob: BackfillJob | null;
}) {
  const router = useRouter();
  const [hiddenCompletedJobId, setHiddenCompletedJobId] = useState<
    string | null
  >(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshGate] = useState(() =>
    createRefreshGate(() => router.refresh()),
  );
  const [refreshScheduler] = useState(() =>
    createRefreshScheduler(
      () => {
        refreshGate.run();
      },
      BACKFILL_REFRESH_DELAY_MS,
    ),
  );
  const handleJobUpdate = useCallback(
    (nextJob: BackfillJob) => {
      if (nextJob.status === "complete" || nextJob.status === "failed") {
        refreshScheduler.flush();
        return;
      }

      refreshScheduler.schedule();
    },
    [refreshScheduler],
  );

  const { job, retrying, retry } = useBackfillJob(initialJob, {
    onJobUpdate: handleJobUpdate,
  });

  useEffect(() => {
    refreshGate.markReady();

    return () => {
      refreshGate.markNotReady();
      refreshScheduler.cancel();
    };
  }, [refreshGate, refreshScheduler]);

  useEffect(() => {
    if (!job) return;

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [job]);

  useEffect(() => {
    const completedJobId = job?.status === "complete" ? job.id : null;
    if (!completedJobId) return;

    const timeoutId = window.setTimeout(() => {
      setHiddenCompletedJobId(completedJobId);
    }, BACKFILL_SUCCESS_HIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [job?.id, job?.status]);

  if (!job || hiddenCompletedJobId === job.id) {
    return null;
  }

  const percentage = getBackfillPercentage(job);
  const stageLabel = getBackfillStageLabel(job);
  const lastUpdatedLabel = formatRelativeTime(
    getBackfillLastUpdatedAt(job),
    now,
  );
  const staleMessage = getBackfillStaleMessage(job, now);
  const showResumeAction = job.status !== "failed" && staleMessage !== null;

  if (job.status === "failed") {
    return (
      <div className="mb-4 rounded-[var(--radius-md)] border-2 border-destructive/30 bg-destructive/10 px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <WarningCircle
            weight="bold"
            className="mt-0.5 size-5 shrink-0 text-destructive"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold">Import paused</p>
            <p className="text-sm text-muted-foreground">
              {job.last_error_message ??
                "We couldn't finish importing your Threads data. You can keep browsing what's already here or retry the import."}
            </p>
            {stageLabel && (
              <p className="text-xs font-medium text-muted-foreground">
                Last stage: {stageLabel}
              </p>
            )}
            {lastUpdatedLabel && (
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                Last update {lastUpdatedLabel}.
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void retry();
            }}
            disabled={retrying}
          >
            {retrying ? "Retrying..." : "Retry import"}
          </Button>
        </div>
      </div>
    );
  }

  if (job.status === "complete") {
    return (
      <div className="mb-4 rounded-[var(--radius-md)] border-2 border-secondary/30 bg-secondary/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <CheckCircle
            weight="bold"
            className="size-5 shrink-0 text-secondary"
          />
          <div>
            <p className="text-sm font-semibold">Import complete</p>
            <p className="text-sm text-muted-foreground">
              Fresh data is now available across your dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border-2 border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <SpinnerGap
          weight="bold"
          className="mt-0.5 size-5 shrink-0 animate-spin text-primary"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {job.status === "pending"
                ? "Preparing your import"
                : "Importing your posts"}
            </p>
            <p className="text-sm text-muted-foreground">
              {getProgressLabel(job)}. You can keep browsing while this updates
              automatically.
            </p>
            {stageLabel && (
              <p className="text-xs font-medium text-muted-foreground">
                Stage: {stageLabel}
              </p>
            )}
            {lastUpdatedLabel && (
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                Last update {lastUpdatedLabel}.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <ProgressBar percentage={percentage} />
            {percentage !== null && (
              <p className="text-right text-xs font-semibold text-muted-foreground">
                {percentage}%
              </p>
            )}
          </div>
          {staleMessage && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-100/70 px-3 py-2 text-xs font-medium text-amber-950">
              <p>{staleMessage}</p>
              {showResumeAction && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void retry();
                  }}
                  disabled={retrying}
                >
                  {retrying ? "Resuming..." : "Resume import"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
