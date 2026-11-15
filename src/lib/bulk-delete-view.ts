// Wording and retry rules behind the bulk delete dialog.
//
// Framework-free on purpose (no React, no Next, no DOM) so it runs, and is
// unit-tested, in plain Node. The dialog asks these functions what to say about
// a count or a stopped run and which failed posts a retry should pick up.

import {
  CONSECUTIVE_FAILURE_LIMIT,
  type BulkDeleteSummary,
  type StopReason,
} from "@/lib/bulk-delete";
import type { SelectedPost } from "@/lib/post-selection";

export function formatPostCount(n: number): string {
  return n === 1 ? "1 post" : `${n} posts`;
}

// One sentence for every way a run can end early, shown under the result.
// A run that completed has nothing to explain.
const STOP_REASON_MESSAGES: Record<StopReason, string | null> = {
  completed: null,
  user_stopped: "Stopped. The remaining posts are still selected.",
  unauthorized: "Sign in again to continue.",
  reconnect_required: "Reconnect Threads to continue.",
  import_in_progress: "Deleting is paused while posts are importing.",
  consecutive_failures: `Stopped after ${CONSECUTIVE_FAILURE_LIMIT} failures in a row.`,
};

export function getStopReasonMessage(reason: StopReason): string | null {
  return STOP_REASON_MESSAGES[reason];
}

// The posts "Retry failed" runs again, in the order they failed. A post that is
// no longer in Spool (`not_found`) is left out: trying it again can only fail
// the same way. Posts that were never attempted are not failures, so they are
// not here either; they stay selected.
export function getRetryablePosts(summary: BulkDeleteSummary): SelectedPost[] {
  return summary.failed
    .filter(({ code }) => code !== "not_found")
    .map(({ post }) => post);
}
