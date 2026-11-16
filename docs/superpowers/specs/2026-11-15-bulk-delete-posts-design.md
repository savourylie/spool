# Bulk Delete Posts — Design

**Date:** 2026-11-15
**Status:** Approved and implemented. Where the build differs from this text, the "Execution rulings" section of the plan (`docs/superpowers/plans/2026-11-16-bulk-delete-posts.md`) records what changed and why.

## Purpose

Let a user select several posts on the Posts page and delete them from Threads in one action. A deleted post is removed from Threads itself and from Spool, together with its Spool data.

## Goals

- Select posts on the Posts page with checkboxes and delete the selection.
- Each post is deleted on Threads first, then removed from Spool.
- The user sees live progress, can stop midway, and can see which posts failed and why.
- The user is told clearly, before confirming, that deletion is permanent.

## Non-goals (v1)

- Keeping history for deleted posts (no soft delete, no archive view).
- Deleting more than the Threads daily limit in one run, or queueing the rest for another day.
- Background deletion that continues after the tab is closed.
- "Select all posts matching the current filter" across pages.
- Deleting replies from the Replies page.
- Cleaning up Spool rows for posts that were already deleted in the Threads app.

## Anti-goals

- A post must never be removed from Spool while it still exists on Threads because of this feature. Spool removal happens only after Threads confirms the delete.
- No deletion may happen that the user did not confirm in the dialog for that run. Nothing is deferred, scheduled, or retried later on the user's behalf.

## Constraints

Facts from the Threads API documentation (checked 2026-11-15):

- Delete: `DELETE /{threads-media-id}` with the access token as the `access_token` query parameter. Only posts created by the authenticated user can be deleted.
- Success body: `{ "success": true, "deleted_id": "<id>" }`.
- Permissions: `threads_basic` and `threads_delete`.
- Limit: 100 deletes per day per account.
- Quota check: `GET /{threads-user-id}/threads_publishing_limit?fields=delete_quota_usage,delete_config` returns `delete_quota_usage` (used count) and `delete_config: { quota_total: 100, quota_duration: 86400 }`.
- Not documented: the error bodies for a missing permission, a post that no longer exists, or an exhausted quota; whether a deleted post can be restored. The design treats deletion as irreversible and does not rely on specific error codes.

Facts from the project:

- Spool requests only `threads_basic,threads_manage_insights,threads_read_replies` today (`src/lib/threads.ts`). Every existing user must reconnect once to grant `threads_delete`.
- Spool does not store which permissions a user granted.
- `ThreadsAPI.request` (`src/lib/threads-api.ts`) only issues GET requests and retries network failures. When a network failure is turned into an error, the full request URL, including `access_token`, is stored on the error body, and the backfill logs that body.
- `refreshMetrics` (`src/lib/metrics-refresh.ts`, run by the Sync button and the 6-hourly cron) and `refreshVelocityForUser` (`src/lib/velocity-check.ts`, every 30 minutes) fetch insights for each recent post with no per-post error handling. One post that Threads no longer has can abort the whole refresh for that user. This already applies today to posts deleted in the Threads app.
- `refreshMetrics` also writes newly listed Threads posts into `posts`, independently of the backfill.
- Deleting a `posts` row cascades to `post_metrics`, `post_replies`, and `concept_ledger`. `post_predictions.post_id` is set to NULL.
- The Posts page shows 20 posts per page. It has no checkbox, dialog, or selection components (`src/components/ui` has neither).
- The `spool_session` cookie is the raw user UUID (TICKET-084, pending, replaces it with a signed token).
- The Meta app must have the `threads_delete` permission added in the Meta dashboard before the consent screen can grant it. While the app is in Development mode this works for invited testers only.

## Approaches

Three ways of running the deletion were considered.

1. **One request per post, driven by the page (chosen).** After the user confirms, the page deletes posts one at a time and shows progress. Each post succeeds or fails on its own. The tab must stay open; closing it stops the run with no inconsistent state.
2. **One bulk request.** The page sends all ids and waits for a single response. Least code, but no progress, no way to stop, and a timeout leaves the user not knowing which posts were deleted.
3. **Background job.** A jobs table with progress pushed to the page; continues after the tab closes and could carry on the next day. Roughly two to three times the work, and deletions would happen at times the user is not watching.

The user picked approach 1. The daily limit of 100 keeps a run to a minute or two, so keeping the tab open costs little, and visible progress with a stop control suits an irreversible action.

## Decisions made with the user

- Deletion removes the post from Threads, not only from Spool.
- After Threads confirms, the Spool post and all its data are deleted (hard delete, existing cascades). No history is kept.
- Deletion runs one post per request with live progress (approach 1).

## Design

Items marked **(my call)** were decided by the author, not the user, and can be changed at review.

### Permission and reconnect

- Add `threads_delete` to the scope list in `getAuthorizationUrl`. Every new sign-in and every reconnect requests it. **(my call)** The alternative, requesting it only when a user opts in to deleting, was rejected because an ordinary re-login would replace the token with one that lacks the permission.
- Spool does not store granted permissions. Instead it asks Threads: the delete quota call doubles as the permission check. Delete is treated as permitted only when the response contains `delete_config`. An HTTP error response from Threads (a 4xx or 5xx other than 408 and 429) or a JSON object without `delete_config` means "not permitted". When Threads gives no answer (a network failure, a timeout, or still rate limited after the retries), or answers 200 with a body that is `null` or not JSON, the check fails instead, and the selection bar shows "Couldn't check today's delete limit." with Try again. **(my call)** This needs no migration and stays correct whatever the consent screen allows.
- When delete is not permitted, the selection bar shows "Reconnect Threads to enable deleting" linking to `/api/auth/threads`. Reconnecting uses the existing OAuth flow unchanged, which ends on the Posts page and re-runs the backfill as any sign-in does today.
- `docs/threads-setup.md` gains a step: add the `threads_delete` permission to the Threads use case in the Meta dashboard and, if the app serves people who are not testers or don't have a role on it, get it approved through Meta's App Review (see Rollout). `docs/threads-api.md` gains the delete endpoint, quota fields, and limit, and its two existing rows that describe `threads_delete` as a webhook-only permission are corrected.

### Server

**`ThreadsAPI.deletePost(mediaId)`** — sends `DELETE {BASE_URL}/{mediaId}`. Returns on `success: true`; throws `ThreadsAPIError` otherwise. A delete is not idempotent, so it is **not** retried after a network error or timeout (the post may already be gone). A 429 may be retried because the request was not executed.

**Access token kept out of errors and logs.** `createNetworkRequestError` is changed to strip `access_token` from the URL it stores, for all requests. **(my call)** The delete path would otherwise inherit the existing leak described under Constraints.

**`ThreadsAPI.getDeleteQuota()`** — calls the quota endpoint with only the two delete fields. Returns `{ permitted: true, used, total, remaining }` or `{ permitted: false }`. It rejects when Threads gave no answer (a network failure, a timeout, or still rate limited after the retries) or answered 200 with a body that is `null` or not JSON; the route turns that into 500 `quota_check_failed`.

**`GET /api/posts/delete-quota`** — session required (401 otherwise). Returns the quota object above. An expired Threads token returns `{ permitted: false }`. A failed check (a database error, or no answer from Threads) returns 500 `{ error: "quota_check_failed" }`.

**`DELETE /api/posts/[postId]`** (new `src/app/api/posts/[postId]/route.ts`):

1. No session → 401.
2. Load the post by `id` **and** `user_id`. Not found → 404. This is the ownership check.
3. The user's most recent backfill job has status `pending` or `running` → 409 `import_in_progress` (see Edge cases).
4. Expired Threads token → 403 `reconnect_required`.
5. Call `deletePost(threads_media_id)`. On failure → 502 with `{ error: "threads_error", message }`. The Spool row is left untouched. Only a Threads 4xx refusal (other than 408) is shown as a definite failure: `message` is the message from the Threads error body when present, otherwise "Threads couldn't delete this post." Every other failure (a network error, a timeout, a 5xx, a 200 that did not confirm the delete, an unexpected error) leaves the outcome unknown, and `message` is "Couldn't confirm whether Threads deleted this post."
6. Delete the `posts` row. On success → 200 `{ deleted: true }`.
7. If step 6 fails after step 5 succeeded → 500 `{ error: "spool_cleanup_failed" }`, logged server-side. The post is gone from Threads but still listed in Spool. This is a known, rare leftover; see Out of scope.

The route deletes exactly one post per request. There is no bulk endpoint.

### Posts page

Sketch of the table with a selection in progress:

```
  3 selected · Clear            97 deletions left today   [ Delete from Threads ]
 ┌───┬──────────────────────────────┬────────────┬───────┬─────
 │ ▣ │ POST                         │ DATE       │ VIEWS │ ...
 ├───┼──────────────────────────────┼────────────┼───────┼─────
 │ ☑ │ T  First post text preview…  │ Nov 3 2026 │ 1,204 │
 │ ☐ │ I  Another post…             │ Nov 2 2026 │   310 │
 │ ☑ │ T  Third post…               │ Nov 1 2026 │    88 │
```

- A checkbox column is added as the first column of `PostTable`. Clicking a checkbox does not expand the row.
- The header checkbox selects or clears all rows on the current page and shows a mixed state when only some are selected.
- The selection is kept while the user changes page, sort, or filters, so posts from several pages can be selected together. **(my call)** For each selected post the page keeps its id and text preview so the dialog can list posts that are not on the current page.
- A selection bar appears above the table when at least one post is selected: the count, "Clear", the remaining deletions for today, and the "Delete from Threads" button.
- The quota is fetched when the first post is selected and again after each run.
- "Delete from Threads" is disabled, with the reason shown, when: more posts are selected than deletions remain today; a backfill is importing (`isImporting`); or delete is not permitted (the reconnect link is shown instead).

### Confirm dialog

```
  Delete 3 posts from Threads?

  • First post text preview…
  • Third post…
  • A post from another page…

  This permanently deletes these posts from Threads. It cannot be
  undone. Their metrics and replies are also removed from Spool.
  Want a copy first? Export CSV

                                   [ Cancel ]  [ Delete 3 posts ]
```

- Lists up to five previews, then "and N more".
- The confirm button names the exact count and uses the destructive style. There is no type-to-confirm step. **(my call)**
- "Export CSV" links to the existing `/api/export/posts`.

### Progress and results

After confirming, the same dialog shows the run:

```
  Deleting 2 of 3…
  ████████████░░░░░░
                                                        [ Stop ]
```

- Posts are deleted one at a time, in the order selected.
- "Stop" lets the request in flight finish, then ends the run. Posts not yet attempted stay selected.
- The dialog cannot be dismissed while a request is in flight. The browser warns before the tab is closed during a run.
- When the run ends the dialog shows a summary: how many were deleted, and a list of the posts that failed with the reason for each. "Retry failed" runs again for those posts only.
- A 403 `reconnect_required` or 409 `import_in_progress` response stops the run immediately, since every remaining post would fail the same way.
- Three failures in a row also stop the run. **(my call)** A revoked token, a missing permission, or an exhausted quota fails every remaining post, and Threads does not document error codes that would let Spool tell these apart. Posts not yet attempted stay selected.
- Closing the summary refreshes the page data. Deleted posts leave the selection; failed and unattempted posts stay selected.

### Edge cases

- **Backfill running.** A backfill that listed posts before a delete could write the post back into Spool afterwards. Deleting is therefore blocked in the UI and refused by the route while the most recent backfill job is `pending` or `running`. This is the same test the Posts page already uses for `isImporting`, and it deliberately ignores staleness: a stuck job keeps delete blocked until the user clears it with the existing "Resume import" banner. **(my call)** Treating a stale job as finished would be faster to unblock but a slow import that is still alive could write deleted posts back.
- **Sync running at the same moment.** `refreshMetrics` can also write a post back if its listing ran just before the delete. Only the user's newest post can be affected, and the window is a few seconds. This is accepted and not guarded against. **(my call)** The result would be a leftover row, which the next item makes harmless.
- **Leftover rows must not break refreshes.** `refreshMetrics` and `refreshVelocityForUser` are changed so that a failed insights call for one post is logged and skipped instead of aborting the refresh. **(my call)** This feature can leave a row in Spool for a post Threads no longer has (see `spool_cleanup_failed` and the sync case above), and without this change one such row would stop that user's metrics and replies from updating for up to seven days.
- **Post already gone from Threads.** Threads returns an error and the post stays in Spool. It is reported as failed with Threads' message only when that error is a 4xx refusal (other than 408); any other failure is reported as "Couldn't confirm whether Threads deleted this post." (see step 5 under Server).
- **Timeout or network error during a delete.** The outcome is unknown. The post is reported as failed with a message saying the result could not be confirmed, and stays in Spool.
- **Quota runs out mid-run** (for example deletions made elsewhere). The Threads error is reported per post like any other failure, and the three-in-a-row rule ends the run.
- **Every post on the last page deleted.** `?page=N` is then past the last page. The Posts page redirects to the same URL without `page`, keeping sort and filters, so the user lands on page 1 instead of an empty page that looks like data loss.
- **Redirect while a run is going** (accepted limitation). If the page is refreshed mid-run after its page number has gone out of range, the server redirect unmounts the selection bar and the dialog. The run stops after the request in flight, so nothing is deleted unattended, but no summary is shown and posts already deleted stay selected until a later attempt reports them as no longer in Spool. This is rare: only the import banner refreshes the page while a run could be going, and deleting is refused while an import runs.
- **Unlinked predictions.** `post_predictions` rows for a deleted post lose their link. They must not be re-linked to a different post or reappear as awaiting review; the builder verifies how `post-review` treats them and adjusts if needed.
- **Derived analyses** (topic clusters, brand voice, concept library, heatmaps) pick up the change the next time they recompute. No extra recomputation is triggered.

## Rollout

Three release gates must all be met before this feature is deployed to production:

1. **Meta permission.** The `threads_delete` permission is added to the Threads use case in the Meta dashboard and, if the app serves people who are not testers or don't have a role on the app, approved through Meta's App Review. This is a manual step for the app owner. Spool requests the scope on every sign-in, and Threads does not document what the consent screen does when asked for a permission the app does not have or that is not approved; if it rejects the request, deploying first would break sign-in for everyone.
2. **Signed sessions.** TICKET-084 has landed (see Security note).
3. **Real-account checks.** The manual checks 1–5 under Testing have been run against a real Threads account.

After the deploy, existing users see the reconnect prompt the first time they select a post.

## Security note

`DELETE /api/posts/[postId]` trusts the `spool_session` cookie, which today is an unsigned user UUID. Anyone who learns a user's UUID could already read that user's data; with this feature they could also delete that user's Threads posts, which cannot be undone. TICKET-084 (signed sessions) closes this. **Decision (user, 2026-11-15):** build this feature first; TICKET-084 must land before this feature is deployed to production. The two do not depend on each other, so development and local testing of bulk delete do not wait for TICKET-084.

## Testing

- **Unit:** `deletePost` (success, error body, no retry after timeout, retry after 429); `getDeleteQuota` (permitted, missing `delete_config`, error response).
- **Refresh resilience:** `refreshMetrics` and `refreshVelocityForUser` continue past a post whose insights call fails. The stored network error contains no `access_token`.
- **Route tests** (same style as `src/app/api/posts/sync/route.test.ts`): no session; post owned by another user; backfill running; expired token; Threads failure leaves the Spool row; success deletes the row; cleanup failure after a successful Threads delete.
- **Component/logic tests:** selection across pages, header checkbox states, disabled reasons, the run loop (progress, stop, per-post failures, early stop on 403/409 and after three failures in a row, retry failed).
- **Manual, against a real Threads account** (the only way to confirm the undocumented parts):
  1. With a token that lacks `threads_delete`, confirm the quota call reports "not permitted" and the reconnect link appears.
  2. Reconnect, confirm the consent screen asks for the delete permission and the bar shows remaining deletions.
  3. Delete two disposable test posts; confirm they are gone from Threads and from Spool, and the remaining count dropped by two.
  4. Delete a post already removed in the Threads app; confirm it is reported as failed and stays in Spool, and that Sync still completes.
  5. Before step 2, sign in once with the scope added but the permission missing from the Meta dashboard, on a non-production app, to learn what the consent screen does. Record the result in `docs/threads-setup.md`.

## Left to the builder

- Which dialog and checkbox primitives to use (the project has `@base-ui/react` and the shadcn CLI), and their styling within the existing design system.
- Where selection state lives (inside `PostTable` or a small provider), as long as it survives page, sort, and filter changes.
- How `ThreadsAPI.request` is extended for the DELETE method.
- Exact wording of user-facing messages.

## Out of scope

- Removing a Spool row whose post no longer exists on Threads (including the `spool_cleanup_failed` leftover). Such rows stay listed but no longer break refreshes.
- Blocking Sync or the cron while a delete run is in progress.
- Soft delete, undo, or an audit log of deletions.
- Bulk actions other than delete.
