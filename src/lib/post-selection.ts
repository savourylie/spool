// Selection and gate logic behind bulk delete on the Posts page.
//
// Framework-free on purpose (no React, no Next, no DOM) so it runs, and is
// unit-tested, in plain Node. The Posts page keeps a PostSelection in state and
// asks getDeleteGate what the "Delete from Threads" control should do.

import type { ThreadsDeleteQuota } from "@/lib/threads-api.types";

export interface SelectedPost {
  id: string;
  preview: string | null;
}

// Keyed by post id. Insertion order is selection order, which is the order the
// posts are deleted in. Every function below that returns a selection returns
// a new Map and leaves its input untouched, so the result can go straight into
// React state.
export type PostSelection = ReadonlyMap<string, SelectedPost>;

export function togglePost(
  sel: PostSelection,
  post: SelectedPost,
): PostSelection {
  const next = new Map(sel);
  if (!next.delete(post.id)) {
    next.set(post.id, post);
  }
  return next;
}

// Selecting appends only the posts that are not selected yet, in page order.
// Posts that already are keep their position and their stored preview.
// Deselecting removes exactly the page's ids and leaves other pages alone.
export function setPageSelected(
  sel: PostSelection,
  page: SelectedPost[],
  selected: boolean,
): PostSelection {
  if (!selected) {
    return removeFromSelection(
      sel,
      page.map((post) => post.id),
    );
  }

  const next = new Map(sel);
  for (const post of page) {
    if (!next.has(post.id)) {
      next.set(post.id, post);
    }
  }
  return next;
}

export function getPageSelectionState(
  sel: PostSelection,
  pageIds: string[],
): "none" | "some" | "all" {
  if (pageIds.length > 0 && pageIds.every((id) => sel.has(id))) {
    return "all";
  }
  return pageIds.some((id) => sel.has(id)) ? "some" : "none";
}

export function removeFromSelection(
  sel: PostSelection,
  ids: Iterable<string>,
): PostSelection {
  const next = new Map(sel);
  for (const id of ids) {
    next.delete(id);
  }
  return next;
}

export type QuotaState = "loading" | "error" | ThreadsDeleteQuota;

export type DeleteGate =
  | { kind: "ready" }
  | { kind: "disabled"; reason: string }
  | { kind: "reconnect" }
  | { kind: "quota_error" };

// First match wins: a running import blocks everything, then the quota state
// decides, and only a known, permitted quota gets compared with the selection.
export function getDeleteGate(input: {
  selectedCount: number;
  quota: QuotaState;
  isImporting: boolean;
}): DeleteGate {
  const { selectedCount, quota, isImporting } = input;

  if (isImporting) {
    return {
      kind: "disabled",
      reason: "Deleting is paused while posts are importing.",
    };
  }
  if (quota === "loading") {
    return { kind: "disabled", reason: "Checking today's delete limit…" };
  }
  if (quota === "error") {
    return { kind: "quota_error" };
  }
  if (!quota.permitted) {
    return { kind: "reconnect" };
  }
  if (selectedCount > quota.remaining) {
    return { kind: "disabled", reason: overQuotaReason(quota.remaining) };
  }
  return { kind: "ready" };
}

function overQuotaReason(remaining: number): string {
  if (remaining <= 0) {
    return "You've reached today's delete limit.";
  }
  if (remaining === 1) {
    return "You can delete 1 more post today.";
  }
  return `You can delete ${remaining} more posts today.`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// The delete-quota route's answer, checked. Anything that is not exactly one
// of the two shapes it sends is an error, never a guess about what is allowed.
export function readQuota(body: unknown): QuotaState {
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

// The selection bar's count of the deletions left today.
export function formatRemaining(remaining: number): string {
  return remaining === 1
    ? "1 deletion left today"
    : `${remaining} deletions left today`;
}

const DIALOG_PREVIEW_LIMIT = 5;
const EMPTY_PREVIEW = "—";

// Up to `max` preview lines for the confirm dialog, and how many posts did not
// fit ("and N more"). A post with no text (null, empty, or whitespace-only)
// shows a dash. The whitespace-only case is the dialog's own: the Posts table
// shows a dash only for a null or empty preview.
export function getDialogPreviewLines(
  posts: SelectedPost[],
  max = DIALOG_PREVIEW_LIMIT,
): { lines: string[]; moreCount: number } {
  return {
    lines: posts
      .slice(0, max)
      .map(({ preview }) => (preview?.trim() ? preview : EMPTY_PREVIEW)),
    moreCount: Math.max(0, posts.length - max),
  };
}

const SELECT_LABEL_TEXT_LIMIT = 60;

// The accessible name of a post's checkbox in the Posts table. Posts from the
// same day would share a name made from the date, so a post with text is named
// by the start of it: whitespace collapsed and trimmed, and cut after 60
// characters (counted so that an emoji is never split) with "…" marking the
// cut. A post without text is named by its date.
export function getPostSelectLabel(
  preview: string | null,
  publishedLabel: string,
): string {
  const characters = Array.from(preview?.replace(/\s+/g, " ").trim() ?? "");

  if (characters.length === 0) return `Select post from ${publishedLabel}`;
  if (characters.length <= SELECT_LABEL_TEXT_LIMIT) {
    return `Select post: ${characters.join("")}`;
  }

  const cut = characters.slice(0, SELECT_LABEL_TEXT_LIMIT).join("").trimEnd();
  return `Select post: ${cut}…`;
}
