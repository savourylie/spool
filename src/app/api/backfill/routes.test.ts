import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { STALE_BACKFILL_EVENT_MESSAGE } from "@/lib/backfill-recovery";

const mocks = vi.hoisted(() => {
  const scheduledCallbacks: Array<() => void | Promise<void>> = [];

  return {
    activeJobRow: null as Record<string, unknown> | null,
    after: vi.fn((callback: () => void | Promise<void>) => {
      scheduledCallbacks.push(callback);
    }),
    backfillJobEventsInserts: [] as Array<Record<string, unknown>>,
    backfillJobUpdates: [] as Array<Record<string, unknown>>,
    backfillJobsInserts: [] as Array<Record<string, unknown>>,
    from: vi.fn(),
    getSession: vi.fn(),
    insertedJob: { id: "job-new" },
    runBackfill: vi.fn(),
    scheduledCallbacks,
  };
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );

  return {
    ...actual,
    after: mocks.after,
  };
});

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: mocks.from,
  }),
}));

vi.mock("@/lib/backfill", () => ({
  runBackfill: mocks.runBackfill,
}));

import { POST as startBackfill } from "./start/route";
import { POST as retryBackfill } from "./retry/route";

function createJobRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job-active",
    status: "running",
    processed_posts: 12,
    total_posts: 40,
    stage: "fetching_post_insights",
    current_post_id: "media-12",
    last_heartbeat_at: new Date().toISOString(),
    last_error_message: null,
    last_error_status: null,
    last_error_payload: null,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

describe("backfill routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeJobRow = null;
    mocks.backfillJobEventsInserts.length = 0;
    mocks.backfillJobUpdates.length = 0;
    mocks.backfillJobsInserts.length = 0;
    mocks.insertedJob = { id: "job-new" };
    mocks.runBackfill.mockResolvedValue(undefined);
    mocks.scheduledCallbacks.length = 0;
    mocks.getSession.mockReturnValue("user-uuid");

    mocks.from.mockImplementation((table: string) => {
      if (table === "backfill_jobs") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: mocks.activeJobRow,
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            mocks.backfillJobUpdates.push(patch);
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          },
          insert: (payload: Record<string, unknown>) => {
            mocks.backfillJobsInserts.push(payload);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({ data: mocks.insertedJob, error: null }),
              }),
            };
          },
        };
      }

      if (table === "backfill_job_events") {
        return {
          insert: (payload: Record<string, unknown>) => {
            mocks.backfillJobEventsInserts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("returns 409 on retry when a fresh import is already active", async () => {
    mocks.activeJobRow = createJobRow();

    const response = await retryBackfill(
      new NextRequest("http://localhost/api/backfill/retry", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "An import is already in progress",
      jobId: "job-active",
      status: "running",
    });
    expect(mocks.backfillJobsInserts).toHaveLength(0);
    expect(mocks.backfillJobUpdates).toHaveLength(0);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("marks a stale running job failed and creates a fresh retry job", async () => {
    mocks.activeJobRow = createJobRow({
      last_heartbeat_at: new Date(Date.now() - 91_000).toISOString(),
    });

    const response = await retryBackfill(
      new NextRequest("http://localhost/api/backfill/retry", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ jobId: "job-new" });
    expect(mocks.backfillJobUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "failed",
          stage: "fetching_post_insights",
          current_post_id: "media-12",
        }),
      ]),
    );
    expect(mocks.backfillJobEventsInserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          job_id: "job-active",
          message: STALE_BACKFILL_EVENT_MESSAGE,
          stage: "fetching_post_insights",
        }),
      ]),
    );
    expect(mocks.backfillJobsInserts).toEqual([
      expect.objectContaining({
        user_id: "user-uuid",
        status: "pending",
      }),
    ]);

    expect(mocks.scheduledCallbacks).toHaveLength(1);
    await mocks.scheduledCallbacks[0]();

    expect(mocks.runBackfill).toHaveBeenCalledWith("user-uuid", "job-new");
  });

  it("does not treat a stale running job as a valid start candidate", async () => {
    mocks.activeJobRow = createJobRow({
      last_heartbeat_at: new Date(Date.now() - 91_000).toISOString(),
    });

    const response = await startBackfill(
      new NextRequest("http://localhost/api/backfill/start", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No pending backfill job found",
    });
    expect(mocks.backfillJobUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "failed",
          stage: "fetching_post_insights",
        }),
      ]),
    );
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
