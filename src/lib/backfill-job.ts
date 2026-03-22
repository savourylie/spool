import type { Database } from "@/lib/supabase/database.types";

type BackfillJobRow = Database["public"]["Tables"]["backfill_jobs"]["Row"];

export type BackfillJobStatus =
  | "pending"
  | "running"
  | "complete"
  | "failed";

export type BackfillJob = Pick<
  BackfillJobRow,
  "id" | "processed_posts" | "total_posts"
> & {
  status: BackfillJobStatus;
};

export type BackfillJobSnapshot = {
  job: BackfillJob | null;
  retrying: boolean;
};

export const BACKFILL_IMPORTING_STATUSES = ["pending", "running"] as const;
export const BACKFILL_VISIBLE_STATUSES = [
  ...BACKFILL_IMPORTING_STATUSES,
  "failed",
] as const;
export const BACKFILL_REFRESH_DELAY_MS = 1200;
export const BACKFILL_SUCCESS_HIDE_DELAY_MS = 1500;

export function toBackfillJob(job: {
  id: string;
  status: string;
  processed_posts: number | null;
  total_posts: number | null;
}): BackfillJob {
  return {
    id: job.id,
    status: job.status as BackfillJobStatus,
    processed_posts: job.processed_posts,
    total_posts: job.total_posts,
  };
}

export function createPendingBackfillJob(jobId: string): BackfillJob {
  return {
    id: jobId,
    status: "pending",
    processed_posts: 0,
    total_posts: null,
  };
}

export function isImportingBackfillStatus(
  status: string | null | undefined,
): status is (typeof BACKFILL_IMPORTING_STATUSES)[number] {
  return (
    status === BACKFILL_IMPORTING_STATUSES[0] ||
    status === BACKFILL_IMPORTING_STATUSES[1]
  );
}

export function getBackfillPercentage(job: BackfillJob | null): number | null {
  if (!job) return null;
  if (job.status === "complete") return 100;
  if (!job.total_posts || job.total_posts <= 0) return null;
  return Math.round(((job.processed_posts ?? 0) / job.total_posts) * 100);
}

export function createRefreshScheduler(
  refresh: () => void,
  delayMs = BACKFILL_REFRESH_DELAY_MS,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule() {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        refresh();
      }, delayMs);
    },
    flush() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      refresh();
    },
    cancel() {
      if (!timeoutId) return;
      clearTimeout(timeoutId);
      timeoutId = null;
    },
    hasPending() {
      return timeoutId !== null;
    },
  };
}

export function createRefreshGate(refresh: () => void) {
  let ready = false;

  return {
    markReady() {
      ready = true;
    },
    markNotReady() {
      ready = false;
    },
    run() {
      if (!ready) return false;
      refresh();
      return true;
    },
    isReady() {
      return ready;
    },
  };
}

type BackfillJobListener = (snapshot: BackfillJobSnapshot) => void;
type BackfillJobSubscriber = (
  jobId: string,
  onUpdate: (job: BackfillJob) => void,
) => () => void;
type BackfillRetry = () => Promise<{ jobId: string }>;

export function createBackfillJobController({
  initialJob,
  subscribeToJob,
  retryBackfill,
  onJobUpdate,
}: {
  initialJob: BackfillJob | null;
  subscribeToJob: BackfillJobSubscriber;
  retryBackfill: BackfillRetry;
  onJobUpdate?: (job: BackfillJob) => void;
}) {
  let snapshot: BackfillJobSnapshot = {
    job: initialJob,
    retrying: false,
  };
  let activeJobId: string | null = null;
  let unsubscribeCurrent = () => {};
  const listeners = new Set<BackfillJobListener>();

  const emit = () => {
    const nextSnapshot = { ...snapshot };
    for (const listener of listeners) {
      listener(nextSnapshot);
    }
  };

  const attachToJob = (jobId: string) => {
    if (activeJobId === jobId) return;

    unsubscribeCurrent();
    activeJobId = jobId;
    unsubscribeCurrent = subscribeToJob(jobId, (job) => {
      snapshot = { ...snapshot, job };
      onJobUpdate?.(job);
      emit();
    });
  };

  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener: BackfillJobListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    activateJob(job: BackfillJob | null) {
      if (!job) return;

      const snapshotChanged =
        snapshot.job?.id !== job.id ||
        snapshot.job?.status !== job.status ||
        snapshot.job?.processed_posts !== job.processed_posts ||
        snapshot.job?.total_posts !== job.total_posts;

      if (snapshotChanged) {
        snapshot = { ...snapshot, job };
        emit();
      }

      attachToJob(job.id);
    },
    async retry() {
      snapshot = { ...snapshot, retrying: true };
      emit();

      try {
        const { jobId } = await retryBackfill();
        const nextJob = createPendingBackfillJob(jobId);
        snapshot = {
          job: nextJob,
          retrying: false,
        };
        attachToJob(jobId);
        emit();
        return nextJob;
      } catch (error) {
        snapshot = { ...snapshot, retrying: false };
        emit();
        throw error;
      }
    },
    dispose() {
      unsubscribeCurrent();
      activeJobId = null;
      unsubscribeCurrent = () => {};
      listeners.clear();
    },
  };
}
