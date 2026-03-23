import type { createAdminClient } from "@/lib/supabase/server";
import {
  BACKFILL_IMPORTING_STATUSES,
  BACKFILL_JOB_SELECT_FIELDS,
  getBackfillStageLabel,
  isBackfillJobStale,
  toBackfillJob,
  type BackfillJob,
  type BackfillJobStatus,
} from "@/lib/backfill-job";
import type { Json } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof createAdminClient>;

export const STALE_BACKFILL_EVENT_MESSAGE =
  "Backfill marked failed after stalled heartbeat";

function getStaleBackfillFailurePayload(job: BackfillJob): Json {
  return {
    reason: "stale_job",
    currentPostId: job.current_post_id,
    lastHeartbeatAt: job.last_heartbeat_at,
    stage: job.stage,
  };
}

export function getStaleBackfillFailureMessage(job: BackfillJob) {
  const stageLabel = getBackfillStageLabel(job);

  if (!stageLabel) {
    return "This import stopped reporting progress before it finished. Resume the import to continue from the posts already saved.";
  }

  return `This import stopped reporting progress before it finished. Resume the import to continue from the posts already saved. Last recorded stage: ${stageLabel}.`;
}

export async function getMostRecentBackfillJob(
  supabase: AdminClient,
  userId: string,
  statuses?: readonly BackfillJobStatus[],
) {
  let query = supabase
    .from("backfill_jobs")
    .select(BACKFILL_JOB_SELECT_FIELDS)
    .eq("user_id", userId);

  if (statuses && statuses.length > 0) {
    query = query.in("status", [...statuses]);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toBackfillJob(data) : null;
}

export async function getMostRecentActiveBackfillJob(
  supabase: AdminClient,
  userId: string,
) {
  return getMostRecentBackfillJob(
    supabase,
    userId,
    BACKFILL_IMPORTING_STATUSES,
  );
}

export async function markStaleBackfillJobFailed(
  supabase: AdminClient,
  userId: string,
  job: BackfillJob,
) {
  if (!isBackfillJobStale(job)) {
    return job;
  }

  const failedAt = new Date().toISOString();
  const lastErrorMessage = getStaleBackfillFailureMessage(job);
  const lastErrorPayload = getStaleBackfillFailurePayload(job);

  const { error: updateError } = await supabase
    .from("backfill_jobs")
    .update({
      status: "failed",
      stage: job.stage,
      current_post_id: job.current_post_id,
      last_heartbeat_at: failedAt,
      last_error_message: lastErrorMessage,
      last_error_status: null,
      last_error_payload: lastErrorPayload,
    })
    .eq("id", job.id);

  if (updateError) {
    throw updateError;
  }

  const { error: eventError } = await supabase.from("backfill_job_events").insert({
    job_id: job.id,
    level: "error",
    stage: job.stage,
    message: STALE_BACKFILL_EVENT_MESSAGE,
    details: {
      error: {
        message: lastErrorMessage,
        payload: lastErrorPayload,
        status: null,
      },
      jobId: job.id,
      userId,
    },
  });

  if (eventError) {
    console.error("Failed to persist stale backfill event", {
      userId,
      jobId: job.id,
      error: eventError,
    });
  }

  return {
    ...job,
    status: "failed" as const,
    last_heartbeat_at: failedAt,
    last_error_message: lastErrorMessage,
    last_error_status: null,
    last_error_payload: lastErrorPayload,
  };
}
