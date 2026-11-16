// Delete request and run loop behind bulk delete on the Posts page.
//
// Framework-free on purpose (no React, no Next, no DOM code) so it runs, and is
// unit-tested, in plain Node. requestPostDelete turns one `DELETE
// /api/posts/:postId` call into a DeleteOutcome, runBulkDelete feeds posts to
// it one at a time and sums up the run, and getSelectionAfterRun says which
// posts leave the selection afterwards. The dialog passes in deleteOne,
// shouldStop and onProgress, so it owns the Stop button and the progress bar.

import type { SelectedPost } from "@/lib/post-selection";

// A run ends after this many failures in a row. A revoked token, a missing
// permission or an exhausted quota fails every remaining post, and Threads does
// not document error codes that would let Spool tell these apart.
export const CONSECUTIVE_FAILURE_LIMIT = 3;

// What one delete request came to. `network_error` means the outcome could not
// be confirmed (network failure or unexpected response): the post may or may
// not be gone, so it is reported as failed and stays selected.
export type DeleteOutcome =
  | { ok: true }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "not_found"
        | "import_in_progress"
        | "reconnect_required"
        | "threads_error"
        | "spool_cleanup_failed"
        | "network_error";
      message: string;
    };

export type DeleteFailureCode = Extract<DeleteOutcome, { ok: false }>["code"];

// The error codes the delete route puts in the body of a failed response.
const SERVER_ERROR_CODES = [
  "not_found",
  "import_in_progress",
  "reconnect_required",
  "threads_error",
  "spool_cleanup_failed",
] as const;

type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

function isServerErrorCode(value: unknown): value is ServerErrorCode {
  return SERVER_ERROR_CODES.some((code) => code === value);
}

const SESSION_ENDED_MESSAGE = "Your Spool session ended. Sign in again.";
const NOT_CONFIRMED_MESSAGE = "Couldn't confirm whether this post was deleted.";
const NOT_CONFIRMED_OFFLINE_MESSAGE =
  "Couldn't confirm whether this post was deleted. Check your connection.";

function failure(code: DeleteFailureCode, message: string): DeleteOutcome {
  return { ok: false, code, message };
}

// The JSON object the route answered with. A body that is not JSON (such as
// Next's default 500 page) or not an object reads as having no error and no
// message.
async function readErrorBody(
  response: Response,
): Promise<{ error?: unknown; message?: unknown }> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null ? body : {};
  } catch {
    return {};
  }
}

// Sends one delete request and never rejects. Only the route's own 200 means
// the post is gone from Threads and from Spool; any other response is read as
// an error. One that carries no code the route uses (Next's default 500 page,
// say) leaves the outcome unconfirmed.
export async function requestPostDelete(
  postId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeleteOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/posts/${encodeURIComponent(postId)}`, {
      method: "DELETE",
    });
  } catch {
    // The request may have reached the server and deleted the post before the
    // connection dropped, so this is "unconfirmed", not "not deleted".
    return failure("network_error", NOT_CONFIRMED_OFFLINE_MESSAGE);
  }

  if (response.status === 200) return { ok: true };
  if (response.status === 401) {
    return failure("unauthorized", SESSION_ENDED_MESSAGE);
  }

  const { error, message } = await readErrorBody(response);
  if (!isServerErrorCode(error)) {
    return failure("network_error", NOT_CONFIRMED_MESSAGE);
  }
  return failure(
    error,
    typeof message === "string" && message.trim()
      ? message
      : NOT_CONFIRMED_MESSAGE,
  );
}

export type StopReason =
  | "completed"
  | "user_stopped"
  | "unauthorized"
  | "reconnect_required"
  | "import_in_progress"
  | "consecutive_failures";

export interface BulkDeleteSummary {
  deletedIds: string[];
  failed: { post: SelectedPost; code: DeleteFailureCode; message: string }[];
  notAttempted: SelectedPost[];
  stopReason: StopReason;
}

// These fail every remaining post the same way, so the run ends at once.
function isStopCode(
  code: DeleteFailureCode,
): code is "unauthorized" | "reconnect_required" | "import_in_progress" {
  return (
    code === "unauthorized" ||
    code === "reconnect_required" ||
    code === "import_in_progress"
  );
}

// Why the run must end after this attempt, or null to carry on. The specific
// reason wins over "consecutive_failures" when both apply, and the failure
// limit applies only while a post is left: a third failure on the last post
// just completes the run.
function getStopReason(
  outcome: DeleteOutcome,
  consecutiveFailures: number,
  postsLeft: number,
): StopReason | null {
  if (outcome.ok) return null;
  if (isStopCode(outcome.code)) return outcome.code;
  if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT && postsLeft > 0) {
    return "consecutive_failures";
  }
  return null;
}

// Deletes the posts one at a time, in the given order, and sums up the run.
//
// shouldStop() is asked before every attempt, the first included, so a stop
// lets the request in flight finish and a stop that arrives during the last
// request changes nothing. onProgress(done, total) follows every attempt, a
// failed one included, and is never called before the first. Any success
// resets the count of failures in a row.
export async function runBulkDelete(input: {
  posts: SelectedPost[];
  deleteOne: (postId: string) => Promise<DeleteOutcome>;
  shouldStop: () => boolean;
  onProgress: (done: number, total: number) => void;
}): Promise<BulkDeleteSummary> {
  const { posts, deleteOne, shouldStop, onProgress } = input;
  const deletedIds: string[] = [];
  const failed: BulkDeleteSummary["failed"] = [];
  let attempted = 0;
  let consecutiveFailures = 0;
  let stopReason: StopReason = "completed";

  for (const post of posts) {
    if (shouldStop()) {
      stopReason = "user_stopped";
      break;
    }

    const outcome = await deleteOne(post.id);
    attempted += 1;

    if (outcome.ok) {
      deletedIds.push(post.id);
      consecutiveFailures = 0;
    } else {
      failed.push({ post, code: outcome.code, message: outcome.message });
      consecutiveFailures += 1;
    }
    onProgress(attempted, posts.length);

    const reason = getStopReason(
      outcome,
      consecutiveFailures,
      posts.length - attempted,
    );
    if (reason) {
      stopReason = reason;
      break;
    }
  }

  return {
    deletedIds,
    failed,
    notAttempted: posts.slice(attempted),
    stopReason,
  };
}

// The deleted posts leave the selection, and so do posts that are no longer in
// Spool (`not_found`): trying them again can only fail the same way. Every
// other failure and every post not attempted stays selected, so the user can
// retry it or look at it again.
export function getSelectionAfterRun(summary: BulkDeleteSummary): {
  removeIds: string[];
} {
  const notFoundIds = summary.failed
    .filter(({ code }) => code === "not_found")
    .map(({ post }) => post.id);

  return { removeIds: [...new Set([...summary.deletedIds, ...notFoundIds])] };
}
