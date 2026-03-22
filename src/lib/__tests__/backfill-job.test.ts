import { describe, expect, it, vi } from "vitest";
import {
  createBackfillJobController,
  createRefreshGate,
  createRefreshScheduler,
  createPendingBackfillJob,
  getBackfillStaleMessage,
  isBackfillJobStale,
  type BackfillJob,
} from "../backfill-job";

function createJob(overrides: Partial<BackfillJob> = {}): BackfillJob {
  return {
    id: "job-1",
    status: "pending",
    processed_posts: 0,
    total_posts: null,
    stage: "pending",
    current_post_id: null,
    last_heartbeat_at: "2026-03-22T00:00:00.000Z",
    last_error_message: null,
    last_error_status: null,
    last_error_payload: null,
    created_at: "2026-03-22T00:00:00.000Z",
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

describe("createRefreshScheduler", () => {
  it("debounces refresh calls", () => {
    vi.useFakeTimers();

    const refresh = vi.fn();
    const scheduler = createRefreshScheduler(refresh, 1000);

    scheduler.schedule();
    scheduler.schedule();

    vi.advanceTimersByTime(999);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.schedule();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("flushes immediately and clears pending work", () => {
    vi.useFakeTimers();

    const refresh = vi.fn();
    const scheduler = createRefreshScheduler(refresh, 1000);

    scheduler.schedule();
    scheduler.flush();

    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("only refreshes after the gate is marked ready", () => {
    vi.useFakeTimers();

    const refresh = vi.fn();
    const gate = createRefreshGate(refresh);
    const scheduler = createRefreshScheduler(() => {
      gate.run();
    }, 1000);

    scheduler.schedule();
    vi.advanceTimersByTime(1000);
    expect(refresh).not.toHaveBeenCalled();

    gate.markReady();
    scheduler.schedule();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.flush();
    expect(refresh).toHaveBeenCalledTimes(2);

    gate.markNotReady();
    scheduler.flush();
    expect(refresh).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe("backfill stale state", () => {
  it("marks pending jobs stale after 30 seconds", () => {
    const job = createJob();

    expect(
      isBackfillJobStale(job, new Date("2026-03-22T00:00:29.000Z").getTime()),
    ).toBe(false);
    expect(
      isBackfillJobStale(job, new Date("2026-03-22T00:00:30.000Z").getTime()),
    ).toBe(true);
    expect(
      getBackfillStaleMessage(
        job,
        new Date("2026-03-22T00:00:30.000Z").getTime(),
      ),
    ).toContain("has not started yet");
  });

  it("marks running jobs stale after 90 seconds", () => {
    const job = createJob({
      status: "running",
      stage: "fetching_post_insights",
      current_post_id: "media-1",
      last_heartbeat_at: "2026-03-22T00:00:00.000Z",
      started_at: "2026-03-22T00:00:00.000Z",
    });

    expect(
      isBackfillJobStale(job, new Date("2026-03-22T00:01:29.000Z").getTime()),
    ).toBe(false);
    expect(
      isBackfillJobStale(job, new Date("2026-03-22T00:01:30.000Z").getTime()),
    ).toBe(true);
    expect(
      getBackfillStaleMessage(
        job,
        new Date("2026-03-22T00:01:30.000Z").getTime(),
      ),
    ).toContain("has not reported progress recently");
  });
});

describe("createBackfillJobController", () => {
  it("does not subscribe during controller construction", () => {
    const initialJob = createPendingBackfillJob("job-1");
    const updates: Record<string, (job: BackfillJob) => void> = {};
    const subscribeToJob = vi.fn(
      (jobId: string, onUpdate: (job: BackfillJob) => void) => {
        updates[jobId] = onUpdate;
        return vi.fn();
      },
    );

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob,
      fetchJob: vi.fn().mockResolvedValue(null),
      retryBackfill: vi.fn(),
    });

    expect(controller.getSnapshot().job).toEqual(initialJob);
    expect(subscribeToJob).not.toHaveBeenCalled();
  });

  it("activates the initial job subscription and applies progress updates", () => {
    const initialJob = createPendingBackfillJob("job-1");
    const updates: Record<string, (job: BackfillJob) => void> = {};
    const subscribeToJob = vi.fn(
      (jobId: string, onUpdate: (job: BackfillJob) => void) => {
        updates[jobId] = onUpdate;
        return vi.fn();
      },
    );

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob,
      fetchJob: vi.fn().mockResolvedValue(null),
      retryBackfill: vi.fn(),
    });

    controller.activateJob(initialJob);

    expect(subscribeToJob).toHaveBeenCalledTimes(1);
    expect(subscribeToJob).toHaveBeenCalledWith("job-1", expect.any(Function));

    updates["job-1"](
      createJob({
        id: "job-1",
        status: "running",
        processed_posts: 4,
        total_posts: 10,
        stage: "fetching_post_insights",
        current_post_id: "media-4",
        started_at: "2026-03-22T00:00:00.000Z",
      }),
    );

    expect(controller.getSnapshot().job).toEqual(
      expect.objectContaining({
        id: "job-1",
        status: "running",
        processed_posts: 4,
        total_posts: 10,
        stage: "fetching_post_insights",
        current_post_id: "media-4",
      }),
    );
  });

  it("does not resubscribe when the same active job is reapplied", () => {
    const initialJob = createPendingBackfillJob("job-1");
    const subscribeToJob = vi.fn(() => vi.fn());

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob,
      fetchJob: vi.fn().mockResolvedValue(null),
      retryBackfill: vi.fn(),
    });

    controller.activateJob(initialJob);
    controller.activateJob(
      createJob({
        id: "job-1",
        status: "running",
        processed_posts: 3,
        total_posts: 10,
        stage: "saving_post_metrics",
        current_post_id: "media-3",
        started_at: "2026-03-22T00:00:00.000Z",
      }),
    );

    expect(subscribeToJob).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().job).toEqual(
      expect.objectContaining({
        id: "job-1",
        status: "running",
        processed_posts: 3,
        total_posts: 10,
        stage: "saving_post_metrics",
        current_post_id: "media-3",
      }),
    );
  });

  it("switches to a new subscription after retry", async () => {
    const initialJob = createPendingBackfillJob("job-1");
    const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];
    const subscribeToJob = vi.fn(() => {
      const unsubscribe = vi.fn();
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    });
    const retryBackfill = vi.fn().mockResolvedValue({ jobId: "job-2" });

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob,
      fetchJob: vi.fn().mockResolvedValue(null),
      retryBackfill,
    });

    controller.activateJob(initialJob);
    await controller.retry();

    expect(retryBackfill).toHaveBeenCalledTimes(1);
    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(subscribeToJob).toHaveBeenNthCalledWith(
      2,
      "job-2",
      expect.any(Function),
    );
    expect(controller.getSnapshot()).toEqual({
      job: expect.objectContaining({
        id: "job-2",
        status: "pending",
        stage: "pending",
      }),
      retrying: false,
    });
  });

  it("polls for job updates when realtime is quiet and stops after completion", async () => {
    vi.useFakeTimers();

    const initialJob = createPendingBackfillJob("job-1");
    const fetchJob = vi
      .fn()
      .mockResolvedValueOnce(
        createJob({
          id: "job-1",
          status: "running",
          stage: "fetching_posts",
          started_at: "2026-03-22T00:00:01.000Z",
          last_heartbeat_at: "2026-03-22T00:00:01.000Z",
        }),
      )
      .mockResolvedValueOnce(
        createJob({
          id: "job-1",
          status: "complete",
          stage: "complete",
          processed_posts: 12,
          total_posts: 12,
          started_at: "2026-03-22T00:00:01.000Z",
          completed_at: "2026-03-22T00:00:05.000Z",
          last_heartbeat_at: "2026-03-22T00:00:05.000Z",
        }),
      );

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob: vi.fn(() => vi.fn()),
      fetchJob,
      retryBackfill: vi.fn(),
      pollIntervalMs: 1000,
    });

    controller.activateJob(initialJob);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchJob).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().job).toEqual(
      expect.objectContaining({
        status: "running",
        stage: "fetching_posts",
      }),
    );

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchJob).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().job).toEqual(
      expect.objectContaining({
        status: "complete",
        stage: "complete",
        processed_posts: 12,
      }),
    );

    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchJob).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
