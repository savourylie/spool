import { describe, expect, it, vi } from "vitest";
import {
  createBackfillJobController,
  createRefreshGate,
  createRefreshScheduler,
  createPendingBackfillJob,
  type BackfillJob,
} from "../backfill-job";

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

describe("createBackfillJobController", () => {
  it("does not subscribe during controller construction", () => {
    const initialJob: BackfillJob = {
      id: "job-1",
      status: "pending",
      processed_posts: 0,
      total_posts: null,
    };
    const updates: Record<string, (job: BackfillJob) => void> = {};
    const subscribeToJob = vi.fn((jobId: string, onUpdate: (job: BackfillJob) => void) => {
      updates[jobId] = onUpdate;
      return vi.fn();
    });

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob,
      retryBackfill: vi.fn(),
    });

    expect(controller.getSnapshot().job).toEqual(initialJob);
    expect(subscribeToJob).not.toHaveBeenCalled();
  });

  it("activates the initial job subscription and applies progress updates", () => {
    const initialJob: BackfillJob = {
      id: "job-1",
      status: "pending",
      processed_posts: 0,
      total_posts: null,
    };
    const updates: Record<string, (job: BackfillJob) => void> = {};
    const subscribeToJob = vi.fn((jobId: string, onUpdate: (job: BackfillJob) => void) => {
      updates[jobId] = onUpdate;
      return vi.fn();
    });

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob,
      retryBackfill: vi.fn(),
    });

    controller.activateJob(initialJob);

    expect(subscribeToJob).toHaveBeenCalledTimes(1);
    expect(subscribeToJob).toHaveBeenCalledWith("job-1", expect.any(Function));

    updates["job-1"]({
      id: "job-1",
      status: "running",
      processed_posts: 4,
      total_posts: 10,
    });

    expect(controller.getSnapshot().job).toEqual({
      id: "job-1",
      status: "running",
      processed_posts: 4,
      total_posts: 10,
    });
  });

  it("does not resubscribe when the same active job is reapplied", () => {
    const initialJob = createPendingBackfillJob("job-1");
    const subscribeToJob = vi.fn(() => vi.fn());

    const controller = createBackfillJobController({
      initialJob,
      subscribeToJob,
      retryBackfill: vi.fn(),
    });

    controller.activateJob(initialJob);
    controller.activateJob({
      id: "job-1",
      status: "running",
      processed_posts: 3,
      total_posts: 10,
    });

    expect(subscribeToJob).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().job).toEqual({
      id: "job-1",
      status: "running",
      processed_posts: 3,
      total_posts: 10,
    });
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
      retryBackfill,
    });

    controller.activateJob(initialJob);
    await controller.retry();

    expect(retryBackfill).toHaveBeenCalledTimes(1);
    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(subscribeToJob).toHaveBeenNthCalledWith(2, "job-2", expect.any(Function));
    expect(controller.getSnapshot()).toEqual({
      job: {
        id: "job-2",
        status: "pending",
        processed_posts: 0,
        total_posts: null,
      },
      retrying: false,
    });
  });
});
