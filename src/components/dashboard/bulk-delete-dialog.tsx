"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap } from "@phosphor-icons/react";

import { usePostSelection } from "@/components/dashboard/post-selection-provider";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  type DialogChangeEventDetails,
} from "@/components/ui/dialog";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  getSelectionAfterRun,
  requestPostDelete,
  runBulkDelete,
  type BulkDeleteSummary,
} from "@/lib/bulk-delete";
import {
  formatPostCount,
  getRetryablePosts,
  getStopReasonMessage,
} from "@/lib/bulk-delete-view";
import { getDialogPreviewLines, type SelectedPost } from "@/lib/post-selection";

// Confirm, run and summary for deleting the selected posts from Threads, in one
// dialog. Deleting is irreversible, so the dialog:
//   - shows exactly the posts it will delete: the list it was opened with,
//     copied at open, whatever the caller does with `posts` afterwards;
//   - starts a run only from the confirm button or "Retry failed", never twice
//     at once (`runningRef`), and ends it when the user presses Stop or the
//     dialog goes away (`stopRef`);
//   - cannot be dismissed while a run is in flight;
//   - changes nothing outside itself until the user closes the summary: only
//     then do the posts that are gone leave the selection and the page refresh.
// The caller owns `open`: it closes the dialog when `onOpenChange(false)` runs.

type Phase = "confirm" | "running" | "summary";

const CONFIRM_BODY =
  "This permanently deletes these posts from Threads. It cannot be undone. Their metrics and replies are also removed from Spool.";

const RUN_FAILED_MESSAGE =
  "Something went wrong. Some posts may have been deleted — refresh to check.";

// Handed to onFinished when the last run left no summary, so the caller still
// finds out that a run happened (and can look at the delete quota again).
const NO_SUMMARY: BulkDeleteSummary = {
  deletedIds: [],
  failed: [],
  notAttempted: [],
  stopReason: "completed",
};

export function BulkDeleteDialog({
  open,
  posts,
  onOpenChange,
  onFinished,
}: {
  open: boolean;
  posts: SelectedPost[];
  onOpenChange(open: boolean): void;
  onFinished(summary: BulkDeleteSummary): void;
}) {
  const router = useRouter();
  const { remove } = usePostSelection();

  const [phase, setPhase] = useState<Phase>("confirm");
  const [confirmedPosts, setConfirmedPosts] = useState(posts);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // The latest run only. Null before the first run ends, and after a run that
  // crashed instead of returning one.
  const [summary, setSummary] = useState<BulkDeleteSummary | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  // True from the moment a run starts until it ends, set before any render.
  const runningRef = useRef(false);
  const stopRef = useRef(false);
  // What to take out of the selection on close: the union over every run in
  // this dialog, so one "Retry failed" does not undo an earlier run's result.
  const removeIdsRef = useRef<Set<string>>(new Set());
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Opening starts over at the confirm step with the posts passed in now. This
  // runs while rendering, so the first frame of an open dialog is never the
  // previous session's summary.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPhase("confirm");
      setConfirmedPosts(posts);
      setProgress({ done: 0, total: 0 });
      setSummary(null);
      setIsStopping(false);
    }
  }

  // Opening clears what the last session left behind, except that a run still
  // in flight keeps its flags: clearing them could start a second run beside it.
  // Closing or unmounting tells any run to stop, so nothing keeps deleting
  // behind a dialog that is gone. The request in flight still finishes, since
  // it cannot be taken back, and the run ends after it.
  useEffect(() => {
    if (!open) return;
    removeIdsRef.current = new Set();
    if (!runningRef.current) {
      stopRef.current = false;
    }
    return () => {
      stopRef.current = true;
    };
  }, [open]);

  // A run only lives as long as this tab, so leaving the page asks first.
  useEffect(() => {
    if (phase !== "running") return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  async function start(runPosts: SelectedPost[]) {
    if (runningRef.current) return;
    runningRef.current = true;
    stopRef.current = false;

    setIsStopping(false);
    setSummary(null);
    setProgress({ done: 0, total: runPosts.length });
    setPhase("running");

    let result: BulkDeleteSummary | null = null;
    try {
      result = await runBulkDelete({
        posts: runPosts,
        deleteOne: (postId) => requestPostDelete(postId),
        shouldStop: () => stopRef.current,
        onProgress: (done, total) => setProgress({ done, total }),
      });
    } catch {
      // Not expected: requestPostDelete never rejects and nothing else in the
      // run throws. If it happens anyway, which posts went through is unknown.
    }

    runningRef.current = false;
    if (result) {
      for (const id of getSelectionAfterRun(result).removeIds) {
        removeIdsRef.current.add(id);
      }
    }
    setSummary(result);
    setPhase("summary");
  }

  function handleStop() {
    stopRef.current = true;
    setIsStopping(true);
  }

  // Leaving the summary: now the posts that are gone leave the selection and
  // the page loads again without them, once however many runs there were.
  function finish() {
    remove(removeIdsRef.current);
    router.refresh();
    onFinished(summary ?? NO_SUMMARY);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean, details: DialogChangeEventDetails) {
    if (next) {
      onOpenChange(true);
      return;
    }
    // Escape and an outside press must not end a run in flight. The ref is
    // read as well as the phase, because it changes before the next render.
    if (runningRef.current || phase === "running") {
      details.cancel();
      return;
    }
    if (phase === "summary") {
      finish();
      return;
    }
    onOpenChange(false);
  }

  const count = confirmedPosts.length;
  const { lines, moreCount } = getDialogPreviewLines(confirmedPosts);
  const percentage =
    progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const stopMessage = summary ? getStopReasonMessage(summary.stopReason) : null;
  const retryable = summary ? getRetryablePosts(summary) : [];
  const failedLines = summary
    ? getDialogPreviewLines(
        summary.failed.map(({ post }) => post),
        summary.failed.length,
      ).lines
    : [];

  let title: string;
  if (phase === "confirm") {
    title = `Delete ${formatPostCount(count)} from Threads?`;
  } else if (phase === "running") {
    title = `Deleting ${progress.done} of ${progress.total}…`;
  } else if (summary) {
    const runSize =
      summary.deletedIds.length +
      summary.failed.length +
      summary.notAttempted.length;
    title = `Deleted ${summary.deletedIds.length} of ${formatPostCount(runSize)}.`;
  } else {
    title = RUN_FAILED_MESSAGE;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Cancel takes the first focus: the safe answer to a delete prompt. */}
      <DialogContent initialFocus={cancelRef}>
        <DialogTitle aria-live="polite" className="flex items-center gap-2">
          {phase === "running" ? (
            <SpinnerGap
              weight="bold"
              aria-hidden="true"
              className="size-4 shrink-0 animate-spin"
            />
          ) : null}
          {title}
        </DialogTitle>

        {phase === "confirm" ? (
          <>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-foreground marker:text-ink-4">
              {lines.map((line, index) => (
                <li key={confirmedPosts[index].id}>
                  <span className="block truncate">{line}</span>
                </li>
              ))}
            </ul>
            {moreCount > 0 ? (
              <p className="mt-1 pl-5 text-sm text-ink-3">and {moreCount} more</p>
            ) : null}
            <DialogDescription className="mt-4">{CONFIRM_BODY}</DialogDescription>
            <p className="mt-2 text-sm text-ink-2">
              Want a copy first?{" "}
              <a
                href="/api/export/posts"
                download
                className="font-medium text-accent underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Export CSV
              </a>
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => onOpenChange(false)}
                className={buttonVariants({
                  variant: "outline",
                  className: "focus-visible:outline-solid",
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => start(confirmedPosts)}
                className={buttonVariants({
                  variant: "destructive",
                  className: "focus-visible:outline-solid",
                })}
              >
                {`Delete ${formatPostCount(count)}`}
              </button>
            </div>
          </>
        ) : null}

        {phase === "running" ? (
          <>
            <ProgressBar percentage={percentage} className="mt-4" />
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleStop}
                disabled={isStopping}
                className={buttonVariants({
                  variant: "outline",
                  className: "focus-visible:outline-solid",
                })}
              >
                {isStopping ? "Stopping…" : "Stop"}
              </button>
            </div>
          </>
        ) : null}

        {phase === "summary" ? (
          <>
            {stopMessage ? (
              <p className="mt-3 text-sm text-ink-2">{stopMessage}</p>
            ) : null}
            {summary && summary.failed.length > 0 ? (
              <ul
                tabIndex={0}
                aria-label="Posts that weren't deleted"
                className="mt-4 max-h-48 divide-y divide-line overflow-y-auto border border-line text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {summary.failed.map(({ post, message }, index) => (
                  <li key={post.id} className="px-3 py-2">
                    <span className="block truncate text-foreground">
                      {failedLines[index]}
                    </span>
                    <span className="block break-words text-xs text-destructive">
                      {message}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {retryable.length > 0 ? (
                <button
                  type="button"
                  onClick={() => start(retryable)}
                  className={buttonVariants({
                    variant: "outline",
                    className: "focus-visible:outline-solid",
                  })}
                >
                  Retry failed
                </button>
              ) : null}
              <button
                type="button"
                onClick={finish}
                className={buttonVariants({
                  variant: "candy",
                  className: "focus-visible:outline-solid",
                })}
              >
                Done
              </button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
