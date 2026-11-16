import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  CONSECUTIVE_FAILURE_LIMIT,
  getSelectionAfterRun,
  requestPostDelete,
  runBulkDelete,
  type BulkDeleteSummary,
  type DeleteFailureCode,
  type DeleteOutcome,
} from "../bulk-delete";
import type { SelectedPost } from "../post-selection";

afterEach(() => {
  vi.restoreAllMocks();
});

function post(id: string): SelectedPost {
  return { id, preview: `Preview ${id}` };
}

const [a, b, c, d, e, f, g] = ["a", "b", "c", "d", "e", "f", "g"].map(post);

const OK: DeleteOutcome = { ok: true };

function messageFor(code: DeleteFailureCode): string {
  return `Message for ${code}`;
}

function fail(code: DeleteFailureCode): DeleteOutcome {
  return { ok: false, code, message: messageFor(code) };
}

// What a failed post looks like in a summary.
function failure(failedPost: SelectedPost, code: DeleteFailureCode) {
  return { post: failedPost, code, message: messageFor(code) };
}

describe("requestPostDelete", () => {
  const NOT_CONFIRMED = "Couldn't confirm whether this post was deleted.";

  function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function fetchReturning(response: Response) {
    return vi.fn<typeof fetch>().mockResolvedValue(response);
  }

  it("sends DELETE /api/posts/<encoded id> with no body and no custom headers", async () => {
    const fetchImpl = fetchReturning(jsonResponse({ deleted: true }, 200));

    await requestPostDelete("a/b c?d#e", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/api/posts/a%2Fb%20c%3Fd%23e", {
      method: "DELETE",
    });
  });

  it("uses the global fetch when none is passed", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ deleted: true }, 200));

    await expect(requestPostDelete("post-1")).resolves.toEqual({ ok: true });

    expect(fetchSpy).toHaveBeenCalledWith("/api/posts/post-1", {
      method: "DELETE",
    });
  });

  it("reports a 200 as deleted without reading the body", async () => {
    const response = jsonResponse({ deleted: true }, 200);

    await expect(
      requestPostDelete("post-1", fetchReturning(response)),
    ).resolves.toEqual({ ok: true });

    expect(response.bodyUsed).toBe(false);
  });

  it("reports a 401 as an ended session", async () => {
    const response = jsonResponse({ error: "unauthorized" }, 401);

    await expect(
      requestPostDelete("post-1", fetchReturning(response)),
    ).resolves.toEqual({
      ok: false,
      code: "unauthorized",
      message: "Your Spool session ended. Sign in again.",
    });
  });

  it.each<[string, () => Response]>([
    ["is not JSON", () => new Response("Unauthorized", { status: 401 })],
    ["is empty", () => new Response(null, { status: 401 })],
  ])(
    "reports a 401 as an ended session even when the body %s",
    async (_case, makeResponse) => {
      await expect(
        requestPostDelete("post-1", fetchReturning(makeResponse())),
      ).resolves.toEqual({
        ok: false,
        code: "unauthorized",
        message: "Your Spool session ended. Sign in again.",
      });
    },
  );

  it.each<[number, DeleteFailureCode, string]>([
    [404, "not_found", "This post is no longer in Spool."],
    [
      409,
      "import_in_progress",
      "Deleting is paused while posts are importing.",
    ],
    [403, "reconnect_required", "Reconnect Threads to delete posts."],
    [502, "threads_error", "Threads couldn't delete this post."],
    [
      500,
      "spool_cleanup_failed",
      "Deleted from Threads, but Spool couldn't remove it.",
    ],
  ])(
    "returns the server's code and message for a %i (%s)",
    async (status, code, message) => {
      const response = jsonResponse({ error: code, message }, status);

      await expect(
        requestPostDelete("post-1", fetchReturning(response)),
      ).resolves.toEqual({ ok: false, code, message });
    },
  );

  it.each<[string, Record<string, unknown>]>([
    ["missing", { error: "threads_error" }],
    ["empty", { error: "threads_error", message: "" }],
    ["blank", { error: "threads_error", message: "  \n" }],
    ["not a string", { error: "threads_error", message: 42 }],
  ])(
    "keeps the server's code but says the outcome is unconfirmed when its message is %s",
    async (_case, body) => {
      const response = jsonResponse(body, 502);

      await expect(
        requestPostDelete("post-1", fetchReturning(response)),
      ).resolves.toEqual({
        ok: false,
        code: "threads_error",
        message: NOT_CONFIRMED,
      });
    },
  );

  it.each<[string, () => Response]>([
    [
      "an HTML page (Next's default 500)",
      () =>
        new Response("<!DOCTYPE html><html><body>Error</body></html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
    ],
    ["an empty body", () => new Response(null, { status: 500 })],
  ])("reports a 500 with %s as unconfirmed", async (_case, makeResponse) => {
    await expect(
      requestPostDelete("post-1", fetchReturning(makeResponse())),
    ).resolves.toEqual({
      ok: false,
      code: "network_error",
      message: NOT_CONFIRMED,
    });
  });

  it.each<[string, unknown]>([
    [
      "an unexpected error code",
      { error: "something_else", message: "Something else went wrong." },
    ],
    ["no error code", { message: "Something went wrong." }],
    ["a JSON null", null],
  ])("reports a 500 with %s as unconfirmed", async (_case, body) => {
    const response = jsonResponse(body, 500);

    await expect(
      requestPostDelete("post-1", fetchReturning(response)),
    ).resolves.toEqual({
      ok: false,
      code: "network_error",
      message: NOT_CONFIRMED,
    });
  });

  it("reports a success status other than 200 as unconfirmed, since the server only answers 200 after it deleted the post", async () => {
    const response = new Response(null, { status: 204 });

    await expect(
      requestPostDelete("post-1", fetchReturning(response)),
    ).resolves.toEqual({
      ok: false,
      code: "network_error",
      message: NOT_CONFIRMED,
    });
  });

  it("reports a failed request as unconfirmed and does not throw", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(requestPostDelete("post-1", fetchImpl)).resolves.toEqual({
      ok: false,
      code: "network_error",
      message:
        "Couldn't confirm whether this post was deleted. Check your connection.",
    });
  });
});

describe("runBulkDelete", () => {
  // Runs the loop with a fake deleteOne that answers from `outcomes`, keyed by
  // post id (a post that is not listed is deleted), and a shouldStop that never
  // stops unless told to.
  async function run(
    posts: SelectedPost[],
    options: {
      outcomes?: Record<string, DeleteOutcome>;
      shouldStop?: () => boolean;
    } = {},
  ) {
    const deleteOne = vi.fn(
      async (postId: string): Promise<DeleteOutcome> =>
        options.outcomes?.[postId] ?? OK,
    );
    const shouldStop = vi.fn(options.shouldStop ?? (() => false));
    const onProgress = vi.fn<(done: number, total: number) => void>();

    const summary = await runBulkDelete({
      posts,
      deleteOne,
      shouldStop,
      onProgress,
    });

    return { summary, deleteOne, shouldStop, onProgress };
  }

  function idsDeleted(
    deleteOne: Mock<(postId: string) => Promise<DeleteOutcome>>,
  ): string[] {
    return deleteOne.mock.calls.map(([postId]) => postId);
  }

  describe("a run with nothing in the way", () => {
    it("deletes every post in the given order and completes", async () => {
      const { summary, deleteOne } = await run([c, a, b]);

      expect(idsDeleted(deleteOne)).toEqual(["c", "a", "b"]);
      expect(summary).toEqual({
        deletedIds: ["c", "a", "b"],
        failed: [],
        notAttempted: [],
        stopReason: "completed",
      });
    });

    it("asks whether to stop before each attempt and reports progress after each one", async () => {
      const events: string[] = [];

      await runBulkDelete({
        posts: [a, b, c],
        shouldStop: () => {
          events.push("shouldStop");
          return false;
        },
        deleteOne: async (postId) => {
          events.push(`delete ${postId}`);
          return OK;
        },
        onProgress: (done, total) => {
          events.push(`progress ${done}/${total}`);
        },
      });

      // Never before the first attempt, and never after the last one.
      expect(events).toEqual([
        "shouldStop",
        "delete a",
        "progress 1/3",
        "shouldStop",
        "delete b",
        "progress 2/3",
        "shouldStop",
        "delete c",
        "progress 3/3",
      ]);
    });

    it("counts a failed post as attempted when it reports progress", async () => {
      const { onProgress } = await run([a, b, c], {
        outcomes: { b: fail("threads_error") },
      });

      expect(onProgress.mock.calls).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it("returns an empty completed summary for no posts, without calling anything", async () => {
      const { summary, deleteOne, shouldStop, onProgress } = await run([]);

      expect(summary).toEqual({
        deletedIds: [],
        failed: [],
        notAttempted: [],
        stopReason: "completed",
      });
      expect(deleteOne).not.toHaveBeenCalled();
      expect(shouldStop).not.toHaveBeenCalled();
      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  describe("when the user stops", () => {
    it("stops when asked: nothing more is deleted and the rest are not attempted", async () => {
      const { summary, deleteOne, onProgress } = await run([a, b, c], {
        shouldStop: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
      });

      expect(deleteOne).toHaveBeenCalledTimes(1);
      expect(deleteOne).toHaveBeenCalledWith("a");
      expect(onProgress.mock.calls).toEqual([[1, 3]]);
      expect(summary).toEqual({
        deletedIds: ["a"],
        failed: [],
        notAttempted: [b, c],
        stopReason: "user_stopped",
      });
    });

    it("lets the request in flight finish before it stops", async () => {
      let stopRequested = false;
      const deleteOne = vi.fn(async (): Promise<DeleteOutcome> => {
        // The user clicks Stop while the first request is running.
        stopRequested = true;
        return OK;
      });

      const summary = await runBulkDelete({
        posts: [a, b, c],
        deleteOne,
        shouldStop: () => stopRequested,
        onProgress: () => {},
      });

      expect(deleteOne).toHaveBeenCalledTimes(1);
      expect(summary).toEqual({
        deletedIds: ["a"],
        failed: [],
        notAttempted: [b, c],
        stopReason: "user_stopped",
      });
    });

    it("stops before the first attempt when asked to from the start", async () => {
      const { summary, deleteOne, onProgress } = await run([a, b], {
        shouldStop: () => true,
      });

      expect(deleteOne).not.toHaveBeenCalled();
      expect(onProgress).not.toHaveBeenCalled();
      expect(summary).toEqual({
        deletedIds: [],
        failed: [],
        notAttempted: [a, b],
        stopReason: "user_stopped",
      });
    });

    it("completes when the stop comes during the last request, since every post was attempted", async () => {
      let stopRequested = false;

      const summary = await runBulkDelete({
        posts: [a],
        deleteOne: async () => {
          stopRequested = true;
          return OK;
        },
        shouldStop: () => stopRequested,
        onProgress: () => {},
      });

      expect(summary).toEqual({
        deletedIds: ["a"],
        failed: [],
        notAttempted: [],
        stopReason: "completed",
      });
    });
  });

  describe("when every remaining post would fail the same way", () => {
    it.each<DeleteFailureCode>([
      "unauthorized",
      "reconnect_required",
      "import_in_progress",
    ])("stops on %s, with that post failed and the rest not attempted", async (code) => {
      const { summary, deleteOne, onProgress } = await run([a, b, c, d], {
        outcomes: { b: fail(code) },
      });

      expect(idsDeleted(deleteOne)).toEqual(["a", "b"]);
      expect(onProgress.mock.calls).toEqual([
        [1, 4],
        [2, 4],
      ]);
      expect(summary).toEqual({
        deletedIds: ["a"],
        failed: [failure(b, code)],
        notAttempted: [c, d],
        stopReason: code,
      });
    });

    it.each<DeleteFailureCode>([
      "unauthorized",
      "reconnect_required",
      "import_in_progress",
    ])("stops on %s even when it is the last post", async (code) => {
      const { summary } = await run([a, b], { outcomes: { b: fail(code) } });

      expect(summary).toEqual({
        deletedIds: ["a"],
        failed: [failure(b, code)],
        notAttempted: [],
        stopReason: code,
      });
    });

    it("reports the specific reason when it is also the third failure in a row", async () => {
      const { summary } = await run([a, b, c, d], {
        outcomes: {
          a: fail("not_found"),
          b: fail("threads_error"),
          c: fail("reconnect_required"),
        },
      });

      expect(summary).toEqual({
        deletedIds: [],
        failed: [
          failure(a, "not_found"),
          failure(b, "threads_error"),
          failure(c, "reconnect_required"),
        ],
        notAttempted: [d],
        stopReason: "reconnect_required",
      });
    });
  });

  describe("failures in a row", () => {
    it("allows three of them", () => {
      expect(CONSECUTIVE_FAILURE_LIMIT).toBe(3);
    });

    it("stops after three failures in a row and leaves the rest not attempted", async () => {
      const { summary, deleteOne } = await run([a, b, c, d], {
        outcomes: {
          a: fail("threads_error"),
          b: fail("threads_error"),
          c: fail("threads_error"),
        },
      });

      expect(idsDeleted(deleteOne)).toEqual(["a", "b", "c"]);
      expect(summary).toEqual({
        deletedIds: [],
        failed: [
          failure(a, "threads_error"),
          failure(b, "threads_error"),
          failure(c, "threads_error"),
        ],
        notAttempted: [d],
        stopReason: "consecutive_failures",
      });
    });

    it.each<DeleteFailureCode>([
      "not_found",
      "threads_error",
      "spool_cleanup_failed",
      "network_error",
    ])("counts %s as a failure", async (code) => {
      const { summary } = await run([a, b, c, d], {
        outcomes: { a: fail(code), b: fail(code), c: fail(code) },
      });

      expect(summary.stopReason).toBe("consecutive_failures");
      expect(summary.notAttempted).toEqual([d]);
    });

    it("counts different failure codes together", async () => {
      const { summary } = await run([a, b, c, d], {
        outcomes: {
          a: fail("not_found"),
          b: fail("network_error"),
          c: fail("spool_cleanup_failed"),
        },
      });

      expect(summary.stopReason).toBe("consecutive_failures");
      expect(summary.notAttempted).toEqual([d]);
    });

    it("starts counting again after a success", async () => {
      const { summary, deleteOne } = await run([a, b, c, d, e], {
        outcomes: {
          a: fail("threads_error"),
          b: fail("threads_error"),
          d: fail("threads_error"),
          e: fail("threads_error"),
        },
      });

      expect(idsDeleted(deleteOne)).toEqual(["a", "b", "c", "d", "e"]);
      expect(summary).toEqual({
        deletedIds: ["c"],
        failed: [
          failure(a, "threads_error"),
          failure(b, "threads_error"),
          failure(d, "threads_error"),
          failure(e, "threads_error"),
        ],
        notAttempted: [],
        stopReason: "completed",
      });
    });

    it("stops on the third failure since the last success, not on the third failure overall", async () => {
      const { summary, deleteOne } = await run([a, b, c, d, e, f, g], {
        outcomes: {
          a: fail("threads_error"),
          b: fail("threads_error"),
          d: fail("threads_error"),
          e: fail("threads_error"),
          f: fail("threads_error"),
        },
      });

      // Three failures in all by d, but only d, e and f in a row.
      expect(idsDeleted(deleteOne)).toEqual(["a", "b", "c", "d", "e", "f"]);
      expect(summary.stopReason).toBe("consecutive_failures");
      expect(summary.notAttempted).toEqual([g]);
    });

    it("completes when the third failure in a row is the last post", async () => {
      const { summary } = await run([a, b, c], {
        outcomes: {
          a: fail("threads_error"),
          b: fail("threads_error"),
          c: fail("threads_error"),
        },
      });

      expect(summary).toEqual({
        deletedIds: [],
        failed: [
          failure(a, "threads_error"),
          failure(b, "threads_error"),
          failure(c, "threads_error"),
        ],
        notAttempted: [],
        stopReason: "completed",
      });
    });
  });

  describe("a post that is no longer in Spool", () => {
    it("is failed and not retried, and the run goes on", async () => {
      const { summary, deleteOne } = await run([a, b, c], {
        outcomes: { b: fail("not_found") },
      });

      expect(idsDeleted(deleteOne)).toEqual(["a", "b", "c"]);
      expect(summary).toEqual({
        deletedIds: ["a", "c"],
        failed: [failure(b, "not_found")],
        notAttempted: [],
        stopReason: "completed",
      });
    });
  });
});

describe("getSelectionAfterRun", () => {
  function summaryWith(overrides: Partial<BulkDeleteSummary>) {
    const summary: BulkDeleteSummary = {
      deletedIds: [],
      failed: [],
      notAttempted: [],
      stopReason: "completed",
      ...overrides,
    };
    return summary;
  }

  it("removes the deleted posts and the posts that are no longer in Spool, in that order", () => {
    const summary = summaryWith({
      deletedIds: ["a", "d"],
      failed: [
        failure(b, "not_found"),
        failure(c, "threads_error"),
        failure(e, "not_found"),
      ],
    });

    expect(getSelectionAfterRun(summary)).toEqual({
      removeIds: ["a", "d", "b", "e"],
    });
  });

  it.each<DeleteFailureCode>([
    "unauthorized",
    "import_in_progress",
    "reconnect_required",
    "threads_error",
    "spool_cleanup_failed",
    "network_error",
  ])("keeps a post that failed with %s selected", (code) => {
    const summary = summaryWith({
      deletedIds: ["a"],
      failed: [failure(b, code)],
    });

    expect(getSelectionAfterRun(summary)).toEqual({ removeIds: ["a"] });
  });

  it("keeps the posts that were not attempted selected", () => {
    const summary = summaryWith({
      deletedIds: ["a"],
      notAttempted: [b, c],
      stopReason: "user_stopped",
    });

    expect(getSelectionAfterRun(summary)).toEqual({ removeIds: ["a"] });
  });

  it("removes nothing when nothing was deleted", () => {
    const summary = summaryWith({
      failed: [failure(a, "threads_error")],
      notAttempted: [b],
      stopReason: "consecutive_failures",
    });

    expect(getSelectionAfterRun(summary)).toEqual({ removeIds: [] });
  });

  it("lists an id once even when it was both deleted and reported as not found", () => {
    const summary = summaryWith({
      deletedIds: ["a", "b"],
      failed: [failure(a, "not_found"), failure(b, "not_found")],
    });

    expect(getSelectionAfterRun(summary)).toEqual({ removeIds: ["a", "b"] });
  });

  it("works on the summary of a real run", async () => {
    const outcomes: Record<string, DeleteOutcome> = {
      b: fail("not_found"),
      c: fail("threads_error"),
    };
    const attempted: string[] = [];

    const summary = await runBulkDelete({
      posts: [a, b, c, d, e],
      deleteOne: async (postId) => {
        attempted.push(postId);
        return outcomes[postId] ?? OK;
      },
      // The user stops after the fourth post.
      shouldStop: () => attempted.length >= 4,
      onProgress: () => {},
    });

    // a and d were deleted, b is gone, c failed, and e was never attempted.
    expect(summary.stopReason).toBe("user_stopped");
    expect(getSelectionAfterRun(summary)).toEqual({
      removeIds: ["a", "d", "b"],
    });
  });
});
