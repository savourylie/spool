"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Trash } from "@phosphor-icons/react";

import { BulkDeleteDialog } from "@/components/dashboard/bulk-delete-dialog";
import { usePostSelection } from "@/components/dashboard/post-selection-provider";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getDeleteGate,
  type QuotaState,
  type SelectedPost,
} from "@/lib/post-selection";

// The strip above the Posts table while posts are selected: how many, how many
// deletions are left today, and the one action the delete gate allows. Deleting
// is irreversible, so "Delete from Threads" can be clicked only while
// getDeleteGate says "ready" (it is shown disabled, with the reason, while the
// gate says "disabled"), and never for an empty selection: the gate says
// "ready" for a count of 0, so the strip is simply not rendered then.
//
// The confirm dialog is rendered from here, so the bar outlives the selection:
// it renders nothing only when nothing is selected AND the dialog is closed.
// The dialog stays mounted and open for a whole run, and only its own
// onOpenChange closes it. Unmounting it or closing it from here mid-run would
// end the run after the request in flight with no summary, leaving posts that
// are already gone from Threads selected and on screen.

const QUOTA_URL = "/api/posts/delete-quota";
const QUOTA_ERROR_MESSAGE = "Couldn't check today's delete limit.";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// The route's answer, checked. Anything that is not exactly one of the two
// shapes it sends is an error, never a guess about what is allowed.
function readQuota(body: unknown): QuotaState {
  if (typeof body !== "object" || body === null) return "error";

  const { permitted, used, total, remaining } = body as {
    permitted?: unknown;
    used?: unknown;
    total?: unknown;
    remaining?: unknown;
  };

  if (permitted === false) return { permitted: false };
  if (
    permitted === true &&
    isFiniteNumber(used) &&
    isFiniteNumber(total) &&
    isFiniteNumber(remaining)
  ) {
    return { permitted: true, used, total, remaining };
  }
  return "error";
}

// Never rejects: a non-OK response, a failed request and a body that is not
// JSON or not a quota all come back as "error".
async function requestQuota(): Promise<QuotaState> {
  try {
    // The count changes with every delete, so an answer from the cache is wrong.
    const response = await fetch(QUOTA_URL, { cache: "no-store" });
    if (!response.ok) return "error";
    return readQuota(await response.json());
  } catch {
    return "error";
  }
}

function formatRemaining(remaining: number): string {
  return remaining === 1
    ? "1 deletion left today"
    : `${remaining} deletions left today`;
}

export function PostSelectionBar({ isImporting }: { isImporting: boolean }) {
  const { selection, clear } = usePostSelection();
  const reasonId = useId();

  const [quota, setQuota] = useState<QuotaState>("loading");
  const [open, setOpen] = useState(false);
  // What the dialog deletes: the selection as it was when the button was
  // clicked, kept apart from the live selection.
  const [dialogPosts, setDialogPosts] = useState<SelectedPost[]>([]);

  // Counts the quota requests. A response only counts while no newer request
  // has started, so a slow old answer never overwrites a newer one. Unmounting
  // counts as a newer request, so nothing is set once the bar is gone.
  const latestRequestRef = useRef(0);

  // Leaves the shown quota as it is until the answer comes, so a refetch after
  // a run does not flicker. Whoever wants "loading" shown sets it first.
  const refreshQuota = useCallback(() => {
    latestRequestRef.current += 1;
    const requestId = latestRequestRef.current;

    void requestQuota().then((next) => {
      if (requestId === latestRequestRef.current) setQuota(next);
    });
  }, []);

  useEffect(() => {
    return () => {
      latestRequestRef.current += 1;
    };
  }, []);

  const hasSelection = selection.size > 0;

  // Whenever a selection starts, the quota is unknown again until the request
  // below answers: what an earlier selection saw may be out of date. Set while
  // rendering rather than in the effect, so no frame pairs the old answer with
  // the new selection.
  const [hadSelection, setHadSelection] = useState(hasSelection);
  if (hasSelection !== hadSelection) {
    setHadSelection(hasSelection);
    if (hasSelection) setQuota("loading");
  }

  // A selection starting is what asks for the quota, not every change to it.
  useEffect(() => {
    if (hasSelection) refreshQuota();
  }, [hasSelection, refreshQuota]);

  // After every hook. See the note at the top for why the dialog's `open`
  // keeps the bar alive.
  if (!hasSelection && !open) return null;

  const gate = getDeleteGate({
    selectedCount: selection.size,
    quota,
    isImporting,
  });
  const remainingText =
    quota !== "loading" && quota !== "error" && quota.permitted
      ? formatRemaining(quota.remaining)
      : null;

  // The posts and `open` change in one handler: the dialog takes its posts at
  // the moment `open` turns true.
  function openDialog() {
    setDialogPosts(Array.from(selection.values()));
    setOpen(true);
  }

  function retryQuota() {
    setQuota("loading");
    refreshQuota();
  }

  function renderAction() {
    switch (gate.kind) {
      case "ready":
      case "disabled":
        return (
          <>
            {gate.kind === "disabled" ? (
              <span id={reasonId} className="text-ink-2">
                {gate.reason}
              </span>
            ) : null}
            <button
              type="button"
              onClick={openDialog}
              disabled={gate.kind === "disabled"}
              aria-describedby={gate.kind === "disabled" ? reasonId : undefined}
              className={buttonVariants({
                variant: "destructive",
                size: "sm",
                className: "focus-visible:outline-solid",
              })}
            >
              <Trash weight="bold" aria-hidden="true" className="size-3.5" />
              Delete from Threads
            </button>
          </>
        );
      case "reconnect":
        // A full navigation: the route answers with a redirect to Threads.
        return (
          <a
            href="/api/auth/threads"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "focus-visible:outline-solid",
            })}
          >
            Reconnect Threads to enable deleting
          </a>
        );
      case "quota_error":
        return (
          <>
            <span role="alert" className="font-medium text-destructive">
              {QUOTA_ERROR_MESSAGE}
            </span>
            <button
              type="button"
              onClick={retryQuota}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "focus-visible:outline-solid",
              })}
            >
              Try again
            </button>
          </>
        );
    }
  }

  return (
    <>
      {hasSelection ? (
        <div
          role="region"
          aria-label="Selected posts"
          className="mb-3 flex flex-wrap items-center gap-3 border border-line-strong bg-paper-2 px-3 py-2 text-sm"
        >
          <span aria-live="polite" className="font-medium">
            {`${selection.size} selected`}
          </span>
          <button
            type="button"
            onClick={clear}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "focus-visible:outline-solid",
            })}
          >
            Clear
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {remainingText ? (
              <span className="text-ink-3">{remainingText}</span>
            ) : null}
            {renderAction()}
          </div>
        </div>
      ) : null}
      <BulkDeleteDialog
        open={open}
        posts={dialogPosts}
        onOpenChange={setOpen}
        onFinished={() => refreshQuota()}
      />
    </>
  );
}
