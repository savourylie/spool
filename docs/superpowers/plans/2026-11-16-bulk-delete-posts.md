# Bulk Delete Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user select posts on the Posts page and delete them from Threads and from Spool, one post per request, with live progress, stop, and per-post results.

**Architecture:** The Threads client gains `deletePost` and `getDeleteQuota`. A server module `post-delete.ts` holds the per-post delete rules behind two thin routes (`DELETE /api/posts/[postId]`, `GET /api/posts/delete-quota`). On the client, selection state lives in a provider mounted by a new `dashboard/posts/layout.tsx` (layouts are not re-rendered on search-param changes, so selection survives page, sort, and filter changes). The run loop and every enable/disable rule are pure functions in `src/lib`, so they are unit-tested in Node; the React components only wire them up.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Supabase (admin client), `@base-ui/react` (Checkbox, Dialog), Phosphor icons, Vitest (Node environment, no DOM).

**Spec:** `docs/superpowers/specs/2026-11-15-bulk-delete-posts-design.md`

## Global Constraints

- Use `npm`, never `pnpm`. Add no new dependencies; `@base-ui/react` is already installed.
- Icons come from `@phosphor-icons/react`.
- User-facing copy is English, matching the rest of the dashboard.
- Spool removes a post only after Threads returns `{ "success": true }` for it.
- One post per request. There is no bulk delete endpoint.
- A DELETE to Threads is never retried after a network error or timeout. A 429 may be retried.
- No `access_token` value may appear in any error object or log line.
- The delete limit is read from Threads (`delete_config.quota_total`), not hard-coded; 100 per 24 hours is only the documented default.
- Vitest runs in Node with no DOM. Components are covered by source tests (pattern: `src/app/dashboard/__tests__/posts-sync.source.test.ts`); logic is covered by unit tests of pure functions.
- Next.js 16 route handlers receive `params` as a Promise: `{ params }: { params: Promise<{ postId: string }> }`.

## Review Focus

1. **Double-click on "Delete N posts".** Expected: exactly one run starts. Test: Task 7, `bulk-delete-dialog.source.test.ts` asserts the confirm button is disabled while running; Task 5 `runBulkDelete` is called through a guarded `start` (ref check).
2. **Spool session expires mid-run (401).** Expected: the run stops at once, like a reconnect, instead of failing every remaining post. Test: Task 5, "stops on unauthorized".
3. **A selected post is no longer in Spool (404, e.g. deleted from another tab).** Expected: reported as failed with "This post is no longer in Spool." and dropped from the selection, so "Retry failed" does not loop on it. Test: Task 5, "not_found is failed and not retried".
4. **Post with no text (`text_preview` null) in the dialog list.** Expected: shown as "—", like the table. Test: Task 4, `getDialogPreviewLines`.
5. **The delete-quota request itself fails (network or 500).** Expected: the delete button is disabled with "Couldn't check today's delete limit." and a "Try again" action, not treated as "reconnect". Test: Task 4, `getDeleteGate` with `quota: "error"`.

---

### Task 1: Threads client — delete, quota, scope, token redaction

**Files:**
- Modify: `src/lib/threads-api.ts` (`createNetworkRequestError` at ~55-82, `request` at ~101-189, `fetchWithTimeout` at ~191-214; add two methods)
- Modify: `src/lib/threads-api.types.ts`
- Modify: `src/lib/threads.ts:20` (scope string)
- Modify: `docs/threads-api.md` (scope table row at ~36, webhook row at ~261; add a "Delete posts" section)
- Modify: `docs/threads-setup.md` (new step: add `threads_delete` to the Threads use case before deploying)
- Test: `src/lib/__tests__/threads-api.test.ts`

**Interfaces:**
- Produces (in `threads-api.types.ts`):
  ```ts
  export type ThreadsDeleteQuota =
    | { permitted: true; used: number; total: number; remaining: number }
    | { permitted: false };
  ```
- Produces (on `ThreadsAPI`): `deletePost(mediaId: string): Promise<void>`; `getDeleteQuota(): Promise<ThreadsDeleteQuota>`.
- Produces (exported from `threads-api.ts`): `redactAccessToken(url: string): string`; `getThreadsErrorMessage(error: unknown): string`.

- [ ] **Step 1: Write the failing tests** in `threads-api.test.ts`, using the file's existing `fetchSpy` / `jsonResponse` helpers:
  - `deletePost` sends `DELETE` to `/v1.0/media-1` with `access_token=test-token` (assert `fetchSpy.mock.calls[0][1]?.method === "DELETE"`) and resolves on `{ success: true, deleted_id: "media-1" }`.
  - `deletePost` rejects with `ThreadsAPIError` when the body is `{ success: false }`.
  - `deletePost` rejects with `ThreadsAPIError` (status 400, body kept) on a 400 with `{ error: { message: "Unsupported delete request" } }`.
  - `deletePost` calls fetch exactly once when fetch throws `new TypeError("fetch failed")` (no retry), and the rejected error's `JSON.stringify(err.body)` does not contain `"test-token"`.
  - `deletePost` retries after a 429 and resolves when the second response succeeds (use `vi.useFakeTimers()` or a `Retry-After: 0` header).
  - `getDeleteQuota` requests `/v1.0/user-123/threads_publishing_limit` with `fields=delete_quota_usage,delete_config` and maps `{ data: [{ delete_quota_usage: 3, delete_config: { quota_total: 100, quota_duration: 86400 } }] }` to `{ permitted: true, used: 3, total: 100, remaining: 97 }`.
  - `getDeleteQuota` returns `{ permitted: false }` when `delete_config` is missing, and when the response is a 403 error.
  - `redactAccessToken("https://graph.threads.net/v1.0/me?fields=id&access_token=abc")` returns a URL with `access_token=REDACTED` and `fields=id` intact.
  - `getThreadsErrorMessage(new ThreadsAPIError("x", 400, { error: { message: "Boom" } }))` is `"Boom"`; for a `ThreadsAPIError` with status 408 or `body.reason === "network_error"` it is `"Couldn't confirm whether Threads deleted this post."`; otherwise `"Threads couldn't delete this post."`.

- [ ] **Step 2: Run to verify they fail**

  Run: `npx vitest run src/lib/__tests__/threads-api.test.ts`
  Expected: FAIL (`deletePost is not a function`, etc.)

- [ ] **Step 3: Implement**
  - `request<T>(path, params?, options?: { method?: "GET" | "DELETE"; retryNetworkErrors?: boolean })`. Default `GET`, `retryNetworkErrors: true`. When `retryNetworkErrors` is false, a network error is thrown on the first attempt. `fetchWithTimeout(url, method)` passes `{ method, signal }`.
  - `createNetworkRequestError` stores `redactAccessToken(url)`, which applies to every request.
  - `deletePost` calls `request<{ success?: boolean }>(\`/${mediaId}\`, undefined, { method: "DELETE", retryNetworkErrors: false })` and throws `new ThreadsAPIError("Threads did not confirm the delete", 200, body)` unless `success === true`.
  - `getDeleteQuota` catches every error and returns `{ permitted: false }`; `remaining = Math.max(0, total - used)`.
  - Scope string becomes `"threads_basic,threads_manage_insights,threads_read_replies,threads_delete"`.
  - Docs: in `threads-api.md`, change the `threads_delete` purpose to "Deleting posts (and delete webhook notifications)", and add a "Delete posts" section with the endpoint, success body, quota call, and the 100-per-24-hours default. In `threads-setup.md`, add a step: add the `threads_delete` permission to the Threads use case in the Meta dashboard, and note it must be done before deploying code that requests it.

- [ ] **Step 4: Run to verify they pass**

  Run: `npx vitest run src/lib/__tests__/threads-api.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/threads-api.ts src/lib/threads-api.types.ts src/lib/threads.ts src/lib/__tests__/threads-api.test.ts docs/threads-api.md docs/threads-setup.md
  git commit -m "feat: add Threads delete and delete-quota calls"
  ```

### Task 2: Refreshes skip posts Threads no longer has

**Files:**
- Modify: `src/lib/metrics-refresh.ts` (step 3 loop, ~135-150)
- Modify: `src/lib/velocity-check.ts` (`refreshVelocityForUser` loop, ~259-270)
- Test: `src/lib/__tests__/metrics-refresh.test.ts`
- Create test: `src/lib/__tests__/velocity-refresh.test.ts`

**Interfaces:** None new. Return shapes of `refreshMetrics` and `refreshVelocityForUser` are unchanged; skipped posts are not counted.

- [ ] **Step 1: Write the failing tests**
  - `metrics-refresh.test.ts`: "continues past a post whose insights call fails". Two recent posts; `mockGetPostInsights` rejects for `media-recent-1` and resolves for `media-recent-2`. Assert `refreshMetrics` resolves, `updatedMetrics === 1`, and replies were still fetched for both posts.
  - `velocity-refresh.test.ts`: mock `@/lib/supabase/server`, `@/lib/threads-api`, and `@/lib/crypto` in the style of `metrics-refresh.test.ts`. Two recent posts, the first insights call rejects. Assert `refreshVelocityForUser` resolves with `{ postsProcessed: 2, metricsInserted: 1 }` (match the existing meaning of `postsProcessed` in the function).

- [ ] **Step 2: Run to verify they fail**

  Run: `npx vitest run src/lib/__tests__/metrics-refresh.test.ts src/lib/__tests__/velocity-refresh.test.ts`
  Expected: FAIL (the rejection propagates)

- [ ] **Step 3: Implement** — wrap each per-post insights fetch and insert in `try/catch`; on error `console.error` the post id and `getThreadsErrorMessage(error)` (from Task 1), then `continue`.

- [ ] **Step 4: Run to verify they pass** (same command). Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/metrics-refresh.ts src/lib/velocity-check.ts src/lib/__tests__/metrics-refresh.test.ts src/lib/__tests__/velocity-refresh.test.ts
  git commit -m "fix: keep refreshes going when one post's insights fail"
  ```

### Task 3: Server delete rules and routes

**Files:**
- Create: `src/lib/post-delete.ts`
- Create: `src/app/api/posts/[postId]/route.ts`
- Create: `src/app/api/posts/delete-quota/route.ts`
- Test: `src/lib/__tests__/post-delete.test.ts`, `src/app/api/posts/[postId]/route.test.ts`, `src/app/api/posts/delete-quota/route.test.ts`

**Interfaces:**
- Consumes: `ThreadsAPI.deletePost`, `ThreadsAPI.getDeleteQuota`, `ThreadsDeleteQuota`, `getThreadsErrorMessage` (Task 1); `getMostRecentBackfillJob` (`src/lib/backfill-recovery.ts`); `isImportingBackfillStatus` (`src/lib/backfill-job.ts`); `decrypt` (`src/lib/crypto.ts`); `createAdminClient`.
- Produces (in `post-delete.ts`):
  ```ts
  export type DeletePostErrorCode =
    | "not_found" | "import_in_progress" | "reconnect_required"
    | "threads_error" | "spool_cleanup_failed";
  export type DeletePostResult =
    | { ok: true }
    | { ok: false; code: DeletePostErrorCode; status: 404 | 409 | 403 | 502 | 500; message: string };
  export async function deletePostForUser(userId: string, postId: string): Promise<DeletePostResult>;
  export async function getDeleteQuotaForUser(userId: string): Promise<ThreadsDeleteQuota>;
  ```
- Produces (HTTP): `DELETE /api/posts/:postId` → 200 `{ deleted: true }`, or `{ status }` with body `{ error: code, message }`; 401 `{ error: "unauthorized" }` without a session. `GET /api/posts/delete-quota` → 200 `ThreadsDeleteQuota`; 401 without a session; 500 `{ error: "quota_check_failed" }` on a database error.

- [ ] **Step 1: Write the failing tests** for `deletePostForUser` (mock supabase admin client, `ThreadsAPI`, `decrypt`, `getMostRecentBackfillJob`), one test per rule, in the spec's order:
  - Post not found for this user (query filters by `id` **and** `user_id`) → `not_found`, 404, message `"This post is no longer in Spool."`; `deletePost` not called.
  - Most recent backfill job `pending` → `import_in_progress`, 409; same for `running`. A `failed` or `complete` job does not block.
  - `token_expires_at` in the past → `reconnect_required`, 403.
  - `deletePost` rejects with `ThreadsAPIError(…, 400, { error: { message: "Boom" } })` → `threads_error`, 502, message `"Boom"`; no delete issued on `posts`.
  - `deletePost` resolves → first `post_predictions` is updated to `review_state: "discarded"` where `post_id = postId` and `review_state = "pending"`, then the `posts` delete is issued with `.eq("id", postId).eq("user_id", userId)`; result `{ ok: true }`. Why: `ON DELETE SET NULL` turns a pending prediction into an unlinked pending one, and `linkPredictionToPost` (`src/lib/post-review.ts`, `.is("post_id", null)`) would then link it to the next post with matching text, such as a re-post of the deleted one. Reviewed predictions are left as they are.
  - `deletePost` resolves and either the predictions update or the `posts` delete returns an error → `spool_cleanup_failed`, 500, message `"Deleted from Threads, but Spool couldn't remove it."`; error logged.
  - `getDeleteQuotaForUser`: expired token → `{ permitted: false }`, no Threads call; otherwise returns `getDeleteQuota()`'s result.
  - Route tests (style of `src/app/api/posts/sync/route.test.ts`, mocking `@/lib/session` and `@/lib/post-delete`): 401 with no session; passes the awaited `postId` and session user to `deletePostForUser`; maps a failure result to its status and `{ error, message }`; quota route returns the quota JSON and 401 without a session.

- [ ] **Step 2: Run to verify they fail**

  Run: `npx vitest run src/lib/__tests__/post-delete.test.ts "src/app/api/posts/[postId]/route.test.ts" src/app/api/posts/delete-quota/route.test.ts`
  Expected: FAIL (modules not found)

- [ ] **Step 3: Implement** `post-delete.ts` and both routes. The routes only authenticate, call the module, and serialize. `getDeleteQuotaForUser` throws on a database error so the route can return 500.

- [ ] **Step 4: Run to verify they pass** (same command). Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/post-delete.ts src/lib/__tests__/post-delete.test.ts src/app/api/posts/
  git commit -m "feat: add per-post delete and delete-quota routes"
  ```

### Task 4: Selection and gate logic

**Files:**
- Create: `src/lib/post-selection.ts`
- Test: `src/lib/__tests__/post-selection.test.ts`

**Interfaces:**
- Consumes: `ThreadsDeleteQuota` (Task 1).
- Produces:
  ```ts
  export interface SelectedPost { id: string; preview: string | null }
  export type PostSelection = ReadonlyMap<string, SelectedPost>; // insertion order = selection order
  export function togglePost(sel: PostSelection, post: SelectedPost): PostSelection;
  export function setPageSelected(sel: PostSelection, page: SelectedPost[], selected: boolean): PostSelection;
  export function getPageSelectionState(sel: PostSelection, pageIds: string[]): "none" | "some" | "all";
  export function removeFromSelection(sel: PostSelection, ids: Iterable<string>): PostSelection;
  export type QuotaState = "loading" | "error" | ThreadsDeleteQuota;
  export type DeleteGate =
    | { kind: "ready" }
    | { kind: "disabled"; reason: string }
    | { kind: "reconnect" }
    | { kind: "quota_error" };
  export function getDeleteGate(input: { selectedCount: number; quota: QuotaState; isImporting: boolean }): DeleteGate;
  export function getDialogPreviewLines(posts: SelectedPost[], max?: number): { lines: string[]; moreCount: number };
  ```

- [ ] **Step 1: Write the failing tests**
  - `togglePost` adds then removes; functions never mutate their input.
  - `setPageSelected(sel, page, true)` keeps posts from other pages already selected; `false` removes only the page's ids.
  - `getPageSelectionState`: none / some / all for a 3-post page; `"none"` for an empty page.
  - `getDeleteGate` precedence: `isImporting` → `disabled`, reason `"Deleting is paused while posts are importing."`; `quota: "loading"` → `disabled`, reason `"Checking today's delete limit…"`; `quota: "error"` → `quota_error`; `{ permitted: false }` → `reconnect`; `selectedCount > remaining` → `disabled`, reason `"You can delete 97 more posts today."` (with `remaining: 97`; use `"1 more post"` when 1, `"You've reached today's delete limit."` when 0); otherwise `ready`.
  - `getDialogPreviewLines` with 7 posts returns 5 lines and `moreCount: 2`; a post with `preview: null` becomes `"—"`.

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/lib/__tests__/post-selection.test.ts`. Expected: FAIL

- [ ] **Step 3: Implement** `src/lib/post-selection.ts` (no React imports).

- [ ] **Step 4: Run to verify they pass** (same command). Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/post-selection.ts src/lib/__tests__/post-selection.test.ts
  git commit -m "feat: add post selection and delete gate logic"
  ```

### Task 5: Run loop and client request

**Files:**
- Create: `src/lib/bulk-delete.ts`
- Test: `src/lib/__tests__/bulk-delete.test.ts`

**Interfaces:**
- Consumes: `SelectedPost` (Task 4); the HTTP contract of `DELETE /api/posts/:postId` (Task 3).
- Produces:
  ```ts
  export const CONSECUTIVE_FAILURE_LIMIT = 3;
  export type DeleteOutcome =
    | { ok: true }
    | { ok: false; code: "unauthorized" | "not_found" | "import_in_progress" | "reconnect_required"
          | "threads_error" | "spool_cleanup_failed" | "network_error"; message: string };
  export async function requestPostDelete(postId: string, fetchImpl?: typeof fetch): Promise<DeleteOutcome>;
  export type StopReason = "completed" | "user_stopped" | "unauthorized" | "reconnect_required"
    | "import_in_progress" | "consecutive_failures";
  export type DeleteFailureCode = Extract<DeleteOutcome, { ok: false }>["code"];
  export interface BulkDeleteSummary {
    deletedIds: string[];
    failed: { post: SelectedPost; code: DeleteFailureCode; message: string }[];
    notAttempted: SelectedPost[];
    stopReason: StopReason;
  }
  export async function runBulkDelete(input: {
    posts: SelectedPost[];
    deleteOne: (postId: string) => Promise<DeleteOutcome>;
    shouldStop: () => boolean;
    onProgress: (done: number, total: number) => void;
  }): Promise<BulkDeleteSummary>;
  export function getSelectionAfterRun(summary: BulkDeleteSummary): { removeIds: string[] };
  ```

- [ ] **Step 1: Write the failing tests**
  - `requestPostDelete`: 200 → `{ ok: true }`; 401 → `unauthorized` with `"Your Spool session ended. Sign in again."`; 404/409/403/502/500 → the body's `error` as `code` and its `message`; fetch throws → `network_error`, `"Couldn't reach Spool. Check your connection."`. Asserts the request is `DELETE /api/posts/<encoded id>`.
  - `runBulkDelete` deletes in the given order and calls `onProgress(n, total)` after each post.
  - "stops when asked": `shouldStop` returns true after the first post → `stopReason: "user_stopped"`, remaining posts in `notAttempted`, no further `deleteOne` calls.
  - "stops on unauthorized" (Review Focus 2), "stops on reconnect_required", "stops on import_in_progress": the triggering post is in `failed`, the rest in `notAttempted`.
  - "stops after three failures in a row": outcomes fail, fail, fail, (unused) → `stopReason: "consecutive_failures"`, 4th post in `notAttempted`. A success between failures resets the count (fail, fail, ok, fail, fail → `completed`).
  - "not_found is failed and not retried" (Review Focus 3): `getSelectionAfterRun` returns `removeIds` = deleted ids plus `not_found` ids; other failures and `notAttempted` stay selected.

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/lib/__tests__/bulk-delete.test.ts`. Expected: FAIL

- [ ] **Step 3: Implement** `src/lib/bulk-delete.ts` (no React imports). `spool_cleanup_failed` counts as a failure for the consecutive count.

- [ ] **Step 4: Run to verify they pass** (same command). Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/bulk-delete.ts src/lib/__tests__/bulk-delete.test.ts
  git commit -m "feat: add bulk delete run loop"
  ```

### Task 6: Checkboxes and selection provider on the Posts page

**Files:**
- Create: `src/components/ui/checkbox.tsx` (wrapper over `@base-ui/react/checkbox`, supports `checked`, `indeterminate`, `onCheckedChange`, `aria-label`)
- Create: `src/components/dashboard/post-selection-provider.tsx`
- Create: `src/app/dashboard/posts/layout.tsx`
- Modify: `src/components/dashboard/post-table.tsx`
- Test: `src/app/dashboard/__tests__/posts-selection.source.test.ts`

**Interfaces:**
- Consumes: `togglePost`, `setPageSelected`, `getPageSelectionState`, `removeFromSelection`, `SelectedPost`, `PostSelection` (Task 4).
- Produces: `PostSelectionProvider({ children })` and
  ```ts
  export function usePostSelection(): {
    selection: PostSelection;
    toggle(post: SelectedPost): void;
    setPage(page: SelectedPost[], selected: boolean): void;
    remove(ids: Iterable<string>): void;
    clear(): void;
  };
  ```

- [ ] **Step 1: Write the failing source test** asserting:
  - `posts/layout.tsx` renders `PostSelectionProvider` around `children`.
  - `post-table.tsx` imports `usePostSelection` and `Checkbox`; contains `getPageSelectionState`; contains `stopPropagation` (checkbox clicks must not expand the row); the header checkbox has `aria-label="Select all posts on this page"`; each row checkbox's `aria-label` starts with `"Select post"`.
  - `post-selection-provider.tsx` starts with `"use client"`.

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/app/dashboard/__tests__/posts-selection.source.test.ts`. Expected: FAIL

- [ ] **Step 3: Implement**
  - Provider holds `PostSelection` in `useState`, exposes the hook; the hook throws if used outside the provider.
  - `PostTable`: add a first column (header + rows) with the checkbox; `COLUMN_COUNT` becomes `COLUMNS.length + 1` for colspans. Row checkbox cell stops click and keydown propagation. Header checkbox shows `indeterminate` for `"some"`.

- [ ] **Step 4: Run to verify it passes** (same command), then `npx tsc --noEmit`. Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/ui/checkbox.tsx src/components/dashboard/post-selection-provider.tsx src/app/dashboard/posts/layout.tsx src/components/dashboard/post-table.tsx src/app/dashboard/__tests__/posts-selection.source.test.ts
  git commit -m "feat: add post checkboxes and cross-page selection"
  ```

### Task 7: Selection bar and delete dialog

**Files:**
- Create: `src/components/ui/dialog.tsx` (wrapper over `@base-ui/react/dialog`: root, popup, title, description; supports a controlled `open` and blocking dismissal)
- Create: `src/components/dashboard/post-selection-bar.tsx`
- Create: `src/components/dashboard/bulk-delete-dialog.tsx`
- Modify: `src/app/dashboard/posts/page.tsx` (render `<PostSelectionBar isImporting={isImporting} />` between `ReselectionAlert` and `PostTable`)
- Test: `src/app/dashboard/__tests__/bulk-delete.source.test.ts`

**Interfaces:**
- Consumes: `usePostSelection` (Task 6); `getDeleteGate`, `getDialogPreviewLines`, `QuotaState` (Task 4); `runBulkDelete`, `requestPostDelete`, `getSelectionAfterRun`, `BulkDeleteSummary` (Task 5); `GET /api/posts/delete-quota` (Task 3).
- Produces: `PostSelectionBar({ isImporting }: { isImporting: boolean })`; `BulkDeleteDialog({ open, posts, onOpenChange, onFinished }: { open: boolean; posts: SelectedPost[]; onOpenChange(open: boolean): void; onFinished(summary: BulkDeleteSummary): void })`.

Behavior (from the spec):
- The bar renders nothing when nothing is selected. Otherwise: `"{n} selected"`, a "Clear" button, `"{remaining} deletions left today"` when the quota is known, and the action from `getDeleteGate`: `ready` → destructive button "Delete from Threads"; `disabled` → that button disabled with the reason shown; `reconnect` → link "Reconnect Threads to enable deleting" to `/api/auth/threads`; `quota_error` → "Couldn't check today's delete limit." plus a "Try again" button that refetches.
- The quota is fetched when the selection goes from 0 to ≥1, and again in `onFinished`. A non-OK response or a fetch rejection sets `"error"`.
- Dialog, confirm phase: title `"Delete {n} posts from Threads?"` (`"1 post"` when singular); the preview list from `getDialogPreviewLines` plus `"and {moreCount} more"`; body text exactly: "This permanently deletes these posts from Threads. It cannot be undone. Their metrics and replies are also removed from Spool." followed by "Want a copy first?" and an "Export CSV" link to `/api/export/posts`; buttons "Cancel" and destructive `"Delete {n} posts"`.
- Running phase: `"Deleting {done} of {total}…"`, the existing `ProgressBar`, and a "Stop" button that sets a ref read by `shouldStop`. While running: the dialog ignores dismiss requests, the confirm button is disabled, a second start is ignored via a `runningRef`, and a `beforeunload` listener is registered (removed when the run ends).
- Summary phase: `"Deleted {k} of {n} posts."`; a list of failed posts with each message; a sentence for the stop reason when not `completed` (`unauthorized` → "Sign in again to continue.", `reconnect_required` → "Reconnect Threads to continue.", `import_in_progress` → "Deleting is paused while posts are importing.", `consecutive_failures` → "Stopped after 3 failures in a row.", `user_stopped` → "Stopped. The remaining posts are still selected."); "Retry failed" (only when there are retryable failures, i.e. failures other than `not_found`) runs again with those posts; "Done" closes.
- On close after a run: apply `getSelectionAfterRun` to the selection via `remove`, call `router.refresh()`, and call `onFinished`.

- [ ] **Step 1: Write the failing source test** asserting:
  - `posts/page.tsx` contains `PostSelectionBar` and passes `isImporting`.
  - `post-selection-bar.tsx` contains `"/api/posts/delete-quota"`, `getDeleteGate`, `"/api/auth/threads"`, and `"Reconnect Threads to enable deleting"`.
  - `bulk-delete-dialog.tsx` contains `runBulkDelete`, `requestPostDelete`, `beforeunload`, `runningRef`, `router.refresh()`, `"/api/export/posts"`, and the exact sentence "It cannot be undone."
  - Both component files start with `"use client"`.

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/app/dashboard/__tests__/bulk-delete.source.test.ts`. Expected: FAIL

- [ ] **Step 3: Implement** the dialog wrapper, bar, dialog, and page wiring as described above. Styling follows existing dashboard components (`buttonVariants` with `variant: "destructive"` for delete actions).

- [ ] **Step 4: Run to verify it passes** (same command), then `npx tsc --noEmit`. Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/ui/dialog.tsx src/components/dashboard/post-selection-bar.tsx src/components/dashboard/bulk-delete-dialog.tsx src/app/dashboard/posts/page.tsx src/app/dashboard/__tests__/bulk-delete.source.test.ts
  git commit -m "feat: add bulk delete bar and dialog to the Posts page"
  ```

### Task 8: Whole-branch verification

**Files:** none new.

- [ ] **Step 1: Run the full suite** — `npm test`. Expected: all tests pass (the live smoke test may skip without keys).
- [ ] **Step 2: Lint and types** — `npm run lint` and `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Build** — `npm run build`. Expected: success, with `/api/posts/[postId]` and `/api/posts/delete-quota` listed.
- [ ] **Step 4: Run the app and check the page** (see the `local-dev-env` memory for starting dev and the seed session): with a seed user and no Threads delete permission, select two posts across two pages, confirm the selection survives page, sort, and filter changes, the header checkbox shows mixed state, row clicks on checkboxes do not expand rows, and the bar shows the reconnect link. Screenshot it.
- [ ] **Step 5: Hand the real-account checks to the user.** The spec's manual steps 1-5 need a real Threads account, the Meta dashboard change, and disposable posts. List them for the user; do not delete real posts without their go-ahead.
