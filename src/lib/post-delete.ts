import { isImportingBackfillStatus } from "@/lib/backfill-job";
import { getMostRecentBackfillJob } from "@/lib/backfill-recovery";
import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPIError } from "@/lib/threads";
import {
  ThreadsAPI,
  getThreadsErrorMessage,
  redactAccessToken,
} from "@/lib/threads-api";
import type { ThreadsDeleteQuota } from "@/lib/threads-api.types";

export type DeletePostErrorCode =
  | "not_found"
  | "import_in_progress"
  | "reconnect_required"
  | "threads_error"
  | "spool_cleanup_failed";

export type DeletePostResult =
  | { ok: true }
  | {
      ok: false;
      code: DeletePostErrorCode;
      status: 404 | 409 | 403 | 502 | 500;
      message: string;
    };

type DeletePostFailure = Extract<DeletePostResult, { ok: false }>;
type AdminClient = ReturnType<typeof createAdminClient>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(
  code: DeletePostFailure["code"],
  status: DeletePostFailure["status"],
  message: string,
): DeletePostFailure {
  return { ok: false, code, status, message };
}

function postNotFound(): DeletePostFailure {
  return failure("not_found", 404, "This post is no longer in Spool.");
}

// postgrest-js returns a failed query's error as a plain `{ message, ... }`
// object, not an Error. Thrown as is, it logs as "Unknown error" wherever only
// an Error's message is read, so a failed read is wrapped in an Error that
// says which read failed and why.
function readFailure(context: string, error: unknown): Error {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "Unknown error";

  return new Error(`${context}: ${message}`);
}

async function loadThreadsUser(supabase: AdminClient, userId: string) {
  const { data: user, error } = await supabase
    .from("users")
    .select("threads_user_id, access_token, token_expires_at")
    .eq("id", userId)
    .single();

  if (error) throw readFailure("Failed to load user", error);
  if (!user) throw new Error("User not found");

  return user;
}

// A backfill that listed a post before it was deleted could write it back
// afterwards, so deleting waits for any import to finish. This is the Posts
// page's `isImporting` test: the most recent job, with no staleness check, so
// a stuck job keeps deleting blocked until the user clears it.
async function isImporting(
  supabase: AdminClient,
  userId: string,
): Promise<boolean> {
  try {
    const job = await getMostRecentBackfillJob(supabase, userId);
    return isImportingBackfillStatus(job?.status);
  } catch (error) {
    throw readFailure("Failed to check backfill status", error);
  }
}

function isTokenExpired(user: { token_expires_at: string }): boolean {
  return new Date(user.token_expires_at) <= new Date();
}

// A failed or unconfirmed Threads delete is where Threads and Spool can drift
// apart (a timeout, or a changed success body, may still have deleted the
// post), so it always leaves a trace. Log the post, the HTTP status and the
// message with any access token redacted, never the response body, the request
// URL or the error object.
function logThreadsDeleteFailure(postId: string, error: unknown) {
  const message = redactAccessToken(
    error instanceof Error ? error.message : "Unknown error",
  );

  console.error("Threads delete not confirmed; post kept in Spool", {
    postId,
    ...(error instanceof ThreadsAPIError && typeof error.status === "number"
      ? { status: error.status }
      : {}),
    message,
  });
}

// Threads has already deleted the post when this runs, so the leftover Spool
// row needs a trace on the server. Log the step, the post and the database
// message only, never the token or the error object.
function cleanupFailed(
  step: "discard_pending_predictions" | "delete_post_row",
  postId: string,
  reason: string,
): DeletePostFailure {
  console.error("Post deleted on Threads but not removed from Spool", {
    step,
    postId,
    error: reason,
  });

  return failure(
    "spool_cleanup_failed",
    500,
    "Deleted from Threads, but Spool couldn't remove it.",
  );
}

/**
 * Deletes one post for one user: first on Threads, then from Spool. The Spool
 * row is removed only after Threads confirms the delete, and every query on
 * `posts` is filtered by `userId`, so a user can only delete their own posts.
 *
 * A database error on any read (the post, the backfill job, the user) throws,
 * so a failed read is never reported as "post gone" and never lets a delete
 * through. Any rejection from the Threads call means "not confirmed deleted":
 * it is logged, and the Spool row is left untouched.
 */
export async function deletePostForUser(
  userId: string,
  postId: string,
): Promise<DeletePostResult> {
  // Postgres rejects a malformed uuid, which would surface as a 500.
  if (!UUID_PATTERN.test(postId)) return postNotFound();

  const supabase = createAdminClient();

  // Filtering by `user_id` as well as `id` is the ownership check.
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, threads_media_id")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (postError) throw readFailure("Failed to load post", postError);
  if (!post) return postNotFound();

  if (await isImporting(supabase, userId)) {
    return failure(
      "import_in_progress",
      409,
      "Deleting is paused while posts are importing.",
    );
  }

  const user = await loadThreadsUser(supabase, userId);
  if (isTokenExpired(user)) {
    return failure(
      "reconnect_required",
      403,
      "Reconnect Threads to delete posts.",
    );
  }

  const api = new ThreadsAPI(decrypt(user.access_token), user.threads_user_id);

  try {
    await api.deletePost(post.threads_media_id);
  } catch (error) {
    logThreadsDeleteFailure(postId, error);
    return failure("threads_error", 502, getThreadsErrorMessage(error));
  }

  // Deleting the post would turn a pending prediction into an unlinked pending
  // one (`ON DELETE SET NULL`), and `linkPredictionToPost` would then link it
  // to the next post with matching text, such as a re-post of this one. So
  // pending predictions are discarded first. Reviewed ones stay as they are.
  const { error: predictionsError } = await supabase
    .from("post_predictions")
    .update({ review_state: "discarded" })
    .eq("post_id", postId)
    .eq("review_state", "pending");

  if (predictionsError) {
    return cleanupFailed(
      "discard_pending_predictions",
      postId,
      predictionsError.message,
    );
  }

  const { error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId);

  if (deleteError) {
    return cleanupFailed("delete_post_row", postId, deleteError.message);
  }

  return { ok: true };
}

/**
 * The user's remaining Threads deletions today. An expired token returns
 * `{ permitted: false }` without calling Threads. A database error throws, so
 * the route can answer 500 instead of reporting a wrong quota.
 */
export async function getDeleteQuotaForUser(
  userId: string,
): Promise<ThreadsDeleteQuota> {
  const supabase = createAdminClient();
  const user = await loadThreadsUser(supabase, userId);

  if (isTokenExpired(user)) return { permitted: false };

  const api = new ThreadsAPI(decrypt(user.access_token), user.threads_user_id);
  return api.getDeleteQuota();
}
