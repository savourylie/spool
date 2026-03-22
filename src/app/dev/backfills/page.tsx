import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  BACKFILL_JOB_SELECT_FIELDS,
  getBackfillLastUpdatedAt,
  getBackfillStageLabel,
  toBackfillJob,
  type BackfillJobEvent,
} from "@/lib/backfill-job";
import {
  StickerCard,
  StickerCardContent,
  StickerCardDescription,
  StickerCardHeader,
  StickerCardTitle,
} from "@/components/ui/card";

function isDebugPageEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_INTERNAL_DEBUG_PAGES === "true"
  );
}

function formatTimestamp(value: string | null) {
  if (!value) return "n/a";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default async function DevBackfillsPage() {
  if (!isDebugPageEnabled()) {
    notFound();
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!userId) {
    redirect("/");
  }

  const supabase = createAdminClient();
  const { data: jobs, error: jobsError } = await supabase
    .from("backfill_jobs")
    .select(BACKFILL_JOB_SELECT_FIELDS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const backfillJobs = (jobs ?? []).map((job) => toBackfillJob(job));
  const jobIds = backfillJobs.map((job) => job.id);

  let events: BackfillJobEvent[] = [];

  if (jobIds.length > 0) {
    const { data: eventRows, error: eventsError } = await supabase
      .from("backfill_job_events")
      .select("id, job_id, level, stage, message, details, created_at")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    if (eventsError) {
      throw new Error(eventsError.message);
    }

    events = eventRows ?? [];
  }

  const eventsByJobId = new Map<string, BackfillJobEvent[]>();

  for (const event of events) {
    const existing = eventsByJobId.get(event.job_id) ?? [];
    existing.push(event);
    eventsByJobId.set(event.job_id, existing);
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-bold">Backfill Debugger</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Recent backfill jobs for the current signed-in user, including the
            latest persisted stage, heartbeat, and structured event timeline.
          </p>
        </div>

        {backfillJobs.length === 0 ? (
          <StickerCard>
            <StickerCardHeader>
              <StickerCardTitle>No backfill jobs yet</StickerCardTitle>
              <StickerCardDescription>
                Connect a Threads account to populate this inspector.
              </StickerCardDescription>
            </StickerCardHeader>
          </StickerCard>
        ) : (
          backfillJobs.map((job) => {
            const jobEvents = eventsByJobId.get(job.id) ?? [];

            return (
              <StickerCard
                key={job.id}
                className="hover:rotate-0 hover:scale-100"
              >
                <StickerCardHeader>
                  <StickerCardTitle>
                    {job.status.toUpperCase()} · {job.id}
                  </StickerCardTitle>
                  <StickerCardDescription>
                    {getBackfillStageLabel(job) ?? "No stage recorded"} · Last
                    update {formatTimestamp(getBackfillLastUpdatedAt(job))}
                  </StickerCardDescription>
                </StickerCardHeader>
                <StickerCardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[var(--radius-md)] border-2 border-foreground/10 bg-background px-4 py-3 text-sm">
                      <p>
                        <strong>Processed:</strong>{" "}
                        {job.processed_posts ?? 0}
                        {job.total_posts !== null ? ` / ${job.total_posts}` : ""}
                      </p>
                      <p>
                        <strong>Current post:</strong>{" "}
                        {job.current_post_id ?? "n/a"}
                      </p>
                      <p>
                        <strong>Started:</strong>{" "}
                        {formatTimestamp(job.started_at)}
                      </p>
                      <p>
                        <strong>Completed:</strong>{" "}
                        {formatTimestamp(job.completed_at)}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-md)] border-2 border-foreground/10 bg-background px-4 py-3 text-sm">
                      <p>
                        <strong>Error message:</strong>{" "}
                        {job.last_error_message ?? "n/a"}
                      </p>
                      <p>
                        <strong>Error status:</strong>{" "}
                        {job.last_error_status ?? "n/a"}
                      </p>
                      <p className="font-semibold">Error payload</p>
                      <pre className="mt-2 overflow-x-auto rounded-[var(--radius-sm)] bg-muted px-3 py-2 text-xs">
                        {JSON.stringify(job.last_error_payload, null, 2) ?? "null"}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="font-heading text-xl font-bold">
                      Event Timeline
                    </h2>
                    {jobEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No persisted events for this job yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {jobEvents.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-[var(--radius-md)] border-2 border-foreground/10 bg-background px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold">
                                {event.level.toUpperCase()} · {event.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimestamp(event.created_at)}
                              </p>
                            </div>
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              Stage: {event.stage}
                            </p>
                            <pre className="mt-3 overflow-x-auto rounded-[var(--radius-sm)] bg-muted px-3 py-2 text-xs">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </StickerCardContent>
              </StickerCard>
            );
          })
        )}
      </div>
    </div>
  );
}
