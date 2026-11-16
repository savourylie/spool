import { describe, expect, it } from "vitest";
import {
  CONSECUTIVE_FAILURE_LIMIT,
  type BulkDeleteSummary,
  type DeleteFailureCode,
  type StopReason,
} from "../bulk-delete";
import {
  formatPostCount,
  getRetryablePosts,
  getStopReasonMessage,
} from "../bulk-delete-view";
import type { SelectedPost } from "../post-selection";

function post(id: string, preview: string | null = `Preview ${id}`): SelectedPost {
  return { id, preview };
}

function failure(failedPost: SelectedPost, code: DeleteFailureCode) {
  return { post: failedPost, code, message: `Message for ${code}` };
}

function summaryWith(
  parts: Partial<BulkDeleteSummary> = {},
): BulkDeleteSummary {
  return {
    deletedIds: [],
    failed: [],
    notAttempted: [],
    stopReason: "completed",
    ...parts,
  };
}

describe("formatPostCount", () => {
  it('says "1 post" for exactly one', () => {
    expect(formatPostCount(1)).toBe("1 post");
  });

  it("pluralizes zero and every count above one", () => {
    expect(formatPostCount(0)).toBe("0 posts");
    expect(formatPostCount(2)).toBe("2 posts");
    expect(formatPostCount(100)).toBe("100 posts");
  });
});

describe("getStopReasonMessage", () => {
  it("has nothing to add when the run completed", () => {
    expect(getStopReasonMessage("completed")).toBeNull();
  });

  it.each<[StopReason, string]>([
    ["unauthorized", "Sign in again to continue."],
    ["reconnect_required", "Reconnect Threads to continue."],
    ["import_in_progress", "Deleting is paused while posts are importing."],
    ["user_stopped", "Stopped. The remaining posts are still selected."],
  ])("explains why a run ended with %s", (reason, message) => {
    expect(getStopReasonMessage(reason)).toBe(message);
  });

  it("names the shared failure limit when a run ends on failures in a row", () => {
    expect(getStopReasonMessage("consecutive_failures")).toBe(
      `Stopped after ${CONSECUTIVE_FAILURE_LIMIT} failures in a row.`,
    );
    // The literal text the user reads today, so a changed limit shows up here.
    expect(getStopReasonMessage("consecutive_failures")).toBe(
      "Stopped after 3 failures in a row.",
    );
  });

  it("gives every reason other than completed a non-empty sentence", () => {
    const reasons: StopReason[] = [
      "user_stopped",
      "unauthorized",
      "reconnect_required",
      "import_in_progress",
      "consecutive_failures",
    ];

    for (const reason of reasons) {
      expect(getStopReasonMessage(reason)?.trim()).toBeTruthy();
    }
  });
});

describe("getRetryablePosts", () => {
  const [a, b, c, d] = ["a", "b", "c", "d"].map((id) => post(id));

  it("returns the failed posts in the order they failed", () => {
    const summary = summaryWith({
      failed: [
        failure(c, "threads_error"),
        failure(a, "network_error"),
        failure(b, "threads_error"),
      ],
    });

    expect(getRetryablePosts(summary)).toEqual([c, a, b]);
  });

  it("drops a post that is no longer in Spool, since trying it again can only fail the same way", () => {
    const summary = summaryWith({
      failed: [
        failure(a, "threads_error"),
        failure(b, "not_found"),
        failure(c, "threads_error"),
      ],
    });

    expect(getRetryablePosts(summary)).toEqual([a, c]);
  });

  it.each<DeleteFailureCode>([
    "unauthorized",
    "import_in_progress",
    "reconnect_required",
    "threads_error",
    "spool_cleanup_failed",
    "network_error",
  ])("keeps a post that failed with %s", (code) => {
    expect(getRetryablePosts(summaryWith({ failed: [failure(a, code)] }))).toEqual(
      [a],
    );
  });

  it("returns nothing for an empty summary", () => {
    expect(getRetryablePosts(summaryWith())).toEqual([]);
  });

  it("returns nothing when every failure was a not_found", () => {
    const summary = summaryWith({
      failed: [failure(a, "not_found"), failure(b, "not_found")],
    });

    expect(getRetryablePosts(summary)).toEqual([]);
  });

  it("leaves deleted posts and posts that were never attempted out", () => {
    const summary = summaryWith({
      deletedIds: ["a"],
      failed: [failure(b, "threads_error")],
      notAttempted: [c, d],
      stopReason: "user_stopped",
    });

    expect(getRetryablePosts(summary)).toEqual([b]);
  });

  it("does not change the summary it is given", () => {
    const summary = summaryWith({
      failed: [failure(a, "not_found"), failure(b, "threads_error")],
    });
    const before = JSON.stringify(summary);

    getRetryablePosts(summary);

    expect(JSON.stringify(summary)).toBe(before);
  });
});
