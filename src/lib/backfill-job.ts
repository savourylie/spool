import type { Database } from "@/lib/supabase/database.types";

type BackfillJobRow = Database["public"]["Tables"]["backfill_jobs"]["Row"];

export type BackfillJobEvent =
  Database["public"]["Tables"]["backfill_job_events"]["Row"];

export type BackfillJobStatus =
  | "pending"
  | "running"
  | "complete"
  | "failed";

export type BackfillJob = Omit<
  Pick<
    BackfillJobRow,
    | "id"
    | "processed_posts"
    | "total_posts"
    | "stage"
    | "current_post_id"
    | "last_heartbeat_at"
    | "last_error_message"
    | "last_error_status"
    | "last_error_payload"
    | "created_at"
    | "started_at"
    | "completed_at"
    | "status"
  >,
  "status"
> & {
  status: BackfillJobStatus;
};

export type BackfillJobSnapshot = {
  job: BackfillJob | null;
  retrying: boolean;
};

export const BACKFILL_JOB_SELECT_FIELDS = [
  "id",
  "status",
  "processed_posts",
  "total_posts",
  "stage",
  "current_post_id",
  "last_heartbeat_at",
  "last_error_message",
  "last_error_status",
  "last_error_payload",
  "created_at",
  "started_at",
  "completed_at",
].join(",");

export const BACKFILL_IMPORTING_STATUSES = ["pending", "running"] as const;
export const BACKFILL_VISIBLE_STATUSES = [
  ...BACKFILL_IMPORTING_STATUSES,
  "failed",
] as const;
export const BACKFILL_REFRESH_DELAY_MS = 1200;
export const BACKFILL_SUCCESS_HIDE_DELAY_MS = 1500;
export const BACKFILL_POLL_INTERVAL_MS = 10_000;
export const BACKFILL_PENDING_STALE_MS = 30_000;
export const BACKFILL_RUNNING_STALE_MS = 90_000;

function normalizeJobStatus(status: string): BackfillJobStatus {
  if (
    status === "pending" ||
    status === "running" ||
    status === "complete" ||
    status === "failed"
  ) {
    return status;
  }

  return "pending";
}

export function toBackfillJob(
  job: Pick<
    BackfillJobRow,
    | "id"
    | "status"
    | "processed_posts"
    | "total_posts"
    | "stage"
    | "current_post_id"
    | "last_heartbeat_at"
    | "last_error_message"
    | "last_error_status"
    | "last_error_payload"
    | "created_at"
    | "started_at"
    | "completed_at"
  >,
): BackfillJob {
  return {
    id: job.id,
    status: normalizeJobStatus(job.status),
    processed_posts: job.processed_posts,
    total_posts: job.total_posts,
    stage: job.stage,
    current_post_id: job.current_post_id,
    last_heartbeat_at: job.last_heartbeat_at,
    last_error_message: job.last_error_message,
    last_error_status: job.last_error_status,
    last_error_payload: job.last_error_payload,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };
}

export function createPendingBackfillJob(jobId: string): BackfillJob {
  const now = new Date().toISOString();

  return {
    id: jobId,
    status: "pending",
    processed_posts: 0,
    total_posts: null,
    stage: "pending",
    current_post_id: null,
    last_heartbeat_at: now,
    last_error_message: null,
    last_error_status: null,
    last_error_payload: null,
    created_at: now,
    started_at: null,
    completed_at: null,
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

export function getBackfillLastUpdatedAt(job: BackfillJob | null): string | null {
  if (!job) return null;

  return (
    job.last_heartbeat_at ??
    job.completed_at ??
    job.started_at ??
    job.created_at ??
    null
  );
}

export function getBackfillStaleThresholdMs(job: BackfillJob | null): number | null {
  if (!job) return null;
  if (job.status === "pending") return BACKFILL_PENDING_STALE_MS;
  if (job.status === "running") return BACKFILL_RUNNING_STALE_MS;
  return null;
}

export function isBackfillJobStale(
  job: BackfillJob | null,
  now = Date.now(),
): boolean {
  if (!job || !isImportingBackfillStatus(job.status)) {
    return false;
  }

  const thresholdMs = getBackfillStaleThresholdMs(job);
  const lastUpdatedAt = getBackfillLastUpdatedAt(job);

  if (!thresholdMs || !lastUpdatedAt) {
    return false;
  }

  const lastUpdatedAtMs = new Date(lastUpdatedAt).getTime();
  if (Number.isNaN(lastUpdatedAtMs)) {
    return false;
  }

  return now - lastUpdatedAtMs >= thresholdMs;
}

export function getBackfillStaleMessage(
  job: BackfillJob | null,
  now = Date.now(),
): string | null {
  if (!job || !isBackfillJobStale(job, now)) {
    return null;
  }

  if (job.status === "pending") {
    return "This import has not started yet. The background task may not have launched.";
  }

  return "This import has not reported progress recently. A Threads request or realtime update may be stuck.";
}

function formatStageWords(stage: string) {
  return stage
    .replace(/^fetching_demographics_/, "fetching demographics ")
    .replace(/^saving_demographics_/, "saving demographics ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getBackfillStageLabel(job: BackfillJob | null): string | null {
  if (!job?.stage) {
    return null;
  }

  switch (job.stage) {
    case "pending":
      return "Queued for import";
    case "marking_job_running":
      return "Starting import";
    case "decrypting_access_token":
      return "Preparing account access";
    case "fetching_posts":
      return "Fetching your Threads posts";
    case "saving_total_posts":
      return "Counting discovered posts";
    case "fetching_post_insights":
      return job.current_post_id
        ? `Fetching insights for post ${job.current_post_id}`
        : "Fetching post insights";
    case "saving_post":
      return "Saving post metadata";
    case "saving_post_metrics":
      return "Saving post metrics";
    case "updating_progress":
      return "Updating import progress";
    case "fetching_followers_count":
      return "Fetching follower count";
    case "saving_daily_stats":
      return "Saving follower snapshot";
    case "marking_job_complete":
      return "Finalizing import";
    case "marking_job_failed":
      return "Recording import failure";
    case "complete":
      return "Import complete";
    case "failed":
      return "Import failed";
    default:
      return formatStageWords(job.stage);
  }
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

function areBackfillJobsEqual(a: BackfillJob | null, b: BackfillJob | null) {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.id === b.id &&
    a.status === b.status &&
    a.processed_posts === b.processed_posts &&
    a.total_posts === b.total_posts &&
    a.stage === b.stage &&
    a.current_post_id === b.current_post_id &&
    a.last_heartbeat_at === b.last_heartbeat_at &&
    a.last_error_message === b.last_error_message &&
    a.last_error_status === b.last_error_status &&
    JSON.stringify(a.last_error_payload) ===
      JSON.stringify(b.last_error_payload) &&
    a.created_at === b.created_at &&
    a.started_at === b.started_at &&
    a.completed_at === b.completed_at
  );
}

type BackfillJobListener = (snapshot: BackfillJobSnapshot) => void;
type BackfillJobSubscriber = (
  jobId: string,
  onUpdate: (job: BackfillJob) => void,
) => () => void;
type BackfillJobFetcher = (jobId: string) => Promise<BackfillJob | null>;
type BackfillRetry = () => Promise<{ jobId: string }>;

export function createBackfillJobController({
  initialJob,
  subscribeToJob,
  fetchJob,
  retryBackfill,
  onJobUpdate,
  pollIntervalMs = BACKFILL_POLL_INTERVAL_MS,
}: {
  initialJob: BackfillJob | null;
  subscribeToJob: BackfillJobSubscriber;
  fetchJob: BackfillJobFetcher;
  retryBackfill: BackfillRetry;
  onJobUpdate?: (job: BackfillJob) => void;
  pollIntervalMs?: number;
}) {
  let snapshot: BackfillJobSnapshot = {
    job: initialJob,
    retrying: false,
  };
  let activeJobId: string | null = null;
  let unsubscribeCurrent = () => {};
  let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let polling = false;
  const listeners = new Set<BackfillJobListener>();

  const emit = () => {
    const nextSnapshot = { ...snapshot };
    for (const listener of listeners) {
      listener(nextSnapshot);
    }
  };

  const stopPolling = () => {
    if (!pollTimeoutId) return;
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
  };

  const applyJobUpdate = (job: BackfillJob) => {
    const snapshotChanged = !areBackfillJobsEqual(snapshot.job, job);

    snapshot = { ...snapshot, job };

    if (snapshotChanged) {
      onJobUpdate?.(job);
      emit();
    }

    if (isImportingBackfillStatus(job.status)) {
      schedulePoll();
    } else {
      stopPolling();
    }
  };

  const schedulePoll = () => {
    if (
      pollTimeoutId ||
      polling ||
      !activeJobId ||
      !snapshot.job ||
      !isImportingBackfillStatus(snapshot.job.status)
    ) {
      return;
    }

    pollTimeoutId = setTimeout(async () => {
      pollTimeoutId = null;

      if (
        polling ||
        !activeJobId ||
        !snapshot.job ||
        !isImportingBackfillStatus(snapshot.job.status)
      ) {
        return;
      }

      polling = true;

      try {
        const job = await fetchJob(activeJobId);

        if (job && activeJobId === job.id) {
          applyJobUpdate(job);
        }
      } finally {
        polling = false;

        if (
          activeJobId &&
          snapshot.job &&
          isImportingBackfillStatus(snapshot.job.status)
        ) {
          schedulePoll();
        }
      }
    }, pollIntervalMs);
  };

  const attachToJob = (jobId: string) => {
    if (activeJobId === jobId) {
      schedulePoll();
      return;
    }

    unsubscribeCurrent();
    stopPolling();
    activeJobId = jobId;
    unsubscribeCurrent = subscribeToJob(jobId, (job) => {
      applyJobUpdate(job);
    });
    schedulePoll();
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

      applyJobUpdate(job);
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
        schedulePoll();
        return nextJob;
      } catch (error) {
        snapshot = { ...snapshot, retrying: false };
        emit();
        throw error;
      }
    },
    dispose() {
      unsubscribeCurrent();
      stopPolling();
      activeJobId = null;
      unsubscribeCurrent = () => {};
      listeners.clear();
    },
  };
}
