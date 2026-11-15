import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

const DIALOG = "../../../components/dashboard/bulk-delete-dialog.tsx";
const DIALOG_PRIMITIVE = "../../../components/ui/dialog.tsx";
const BAR = "../../../components/dashboard/post-selection-bar.tsx";
const POSTS_PAGE = "../posts/page.tsx";

describe("bulk delete source", () => {
  describe("dialog component", () => {
    it("is a client component", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toMatch(/^\s*["']use client["']/);
    });

    it("deletes through the shared run loop and request helper, then applies the selection rule", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toContain("runBulkDelete");
      expect(dialog).toContain("requestPostDelete");
      expect(dialog).toContain("getSelectionAfterRun");
      expect(dialog).toMatch(/from "@\/lib\/bulk-delete"/);
    });

    it("ignores a second start while a run is in flight", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toContain("runningRef");
      expect(dialog).toMatch(/if \(runningRef\.current\) return;/);
    });

    it("refuses every dismiss request while running", async () => {
      const dialog = await readSource(DIALOG);

      // The primitive's Escape and outside-press requests are cancelled, and
      // the check reads the ref, which flips before any render.
      expect(dialog).toMatch(/runningRef\.current[^;]*\)\s*\{\s*\w+\.cancel\(\);/);
    });

    it("warns before the tab closes while a run is in flight and removes the warning afterwards", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toContain('addEventListener("beforeunload"');
      expect(dialog).toContain('removeEventListener("beforeunload"');
    });

    it("stops the run when the dialog goes away and when the user presses Stop", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toContain("stopRef");
      expect(dialog).toMatch(/shouldStop: \(\) => stopRef\.current/);
      // One for the Stop button, one for the cleanup on unmount.
      expect(dialog.match(/stopRef\.current = true/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it("applies the selection once on close, then refreshes the route and reports the last summary", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toMatch(/from "next\/navigation"/);
      expect(dialog).toContain("router.refresh()");
      expect(dialog).toMatch(
        /from "@\/components\/dashboard\/post-selection-provider"/,
      );
      // A single remove for the ids gathered over every run in this dialog.
      expect(dialog.match(/\bremove\(/g)).toHaveLength(1);
      expect(dialog).toMatch(/onFinished\(/);
    });

    it("says the delete is permanent and links to the CSV export", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toContain("It cannot be undone.");
      expect(dialog).toContain(
        "This permanently deletes these posts from Threads. It cannot be undone. Their metrics and replies are also removed from Spool.",
      );
      expect(dialog).toContain("Want a copy first?");
      expect(dialog).toMatch(/<a\b[^>]*href="\/api\/export\/posts"/);
      expect(dialog).toMatch(/<a\b[^>]*\bdownload\b/);
      expect(dialog).toContain("Export CSV");
    });

    it("words each phase as specified", async () => {
      const dialog = await readSource(DIALOG);

      // Confirm: the title and the destructive button both name the exact count.
      expect(dialog).toContain("`Delete ${formatPostCount(count)} from Threads?`");
      expect(dialog).toContain("{`Delete ${formatPostCount(count)}`}");
      expect(dialog).toContain("and {moreCount} more");
      // Running.
      expect(dialog).toContain("`Deleting ${progress.done} of ${progress.total}…`");
      expect(dialog).toContain("Stopping…");
      // Summary: the run that just ended, and the line for a run that crashed.
      expect(dialog).toContain(
        "`Deleted ${summary.deletedIds.length} of ${formatPostCount(runSize)}.`",
      );
      expect(dialog).toContain(
        "Something went wrong. Some posts may have been deleted — refresh to check.",
      );
      expect(dialog).toContain("Retry failed");
    });

    it("counts the run that just ended, not the posts the dialog was opened with", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toMatch(
        /summary\.deletedIds\.length \+\s*summary\.failed\.length \+\s*summary\.notAttempted\.length/,
      );
    });

    it("explains a run that stopped early and retries only what the view helpers pick", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toMatch(
        /import \{[^}]*\bgetStopReasonMessage\b[^}]*\} from "@\/lib\/bulk-delete-view"/,
      );
      expect(dialog).toMatch(
        /import \{[^}]*\bgetRetryablePosts\b[^}]*\} from "@\/lib\/bulk-delete-view"/,
      );
      expect(dialog).toContain("getStopReasonMessage(summary.stopReason)");
      expect(dialog).toContain("retryable.length > 0");
      expect(dialog).toContain("start(retryable)");
    });

    it("starts over at the confirm step with the posts it is given each time it opens", async () => {
      const dialog = await readSource(DIALOG);

      // While rendering, so the first frame of an open dialog is never the
      // previous session's summary. Only the block itself is searched: the
      // run start resets some of the same state.
      const reset = dialog.match(/if \(open !== wasOpen\) \{([\s\S]*?)\n  \}\n/)?.[1];
      expect(reset).toBeDefined();
      expect(reset).toContain('setPhase("confirm")');
      expect(reset).toContain("setConfirmedPosts(posts)");
      expect(reset).toContain("setProgress({ done: 0, total: 0 })");
      expect(reset).toContain("setSummary(null)");
      expect(reset).toContain("setIsStopping(false)");
      // The run deletes the posts the dialog showed, not the live prop.
      expect(dialog).toContain("start(confirmedPosts)");
    });

    it("labels the dialog with the primitive's title and description and announces progress", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toMatch(
        /import \{[^}]*\bDialogTitle\b[^}]*\} from "@\/components\/ui\/dialog"/,
      );
      expect(dialog).toMatch(
        /import \{[^}]*\bDialogDescription\b[^}]*\} from "@\/components\/ui\/dialog"/,
      );
      expect(dialog).toContain('aria-live="polite"');
    });

    it("shows progress with the shared ProgressBar", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toMatch(
        /import \{ ProgressBar \} from "@\/components\/ui\/progress-bar"/,
      );
      expect(dialog).toContain("<ProgressBar");
    });

    it("caps the failure list so a hundred failures cannot push the buttons off screen", async () => {
      const dialog = await readSource(DIALOG);

      expect(dialog).toContain("max-h-48");
      expect(dialog).toContain("overflow-y-auto");
    });

    it("keeps the keyboard focus ring visible on every button, which buttonVariants' outline-none would hide", async () => {
      const dialog = await readSource(DIALOG);

      const buttonCalls = dialog.match(/buttonVariants\(/g) ?? [];
      const ringFixes = dialog.match(/focus-visible:outline-solid/g) ?? [];

      expect(buttonCalls.length).toBeGreaterThan(0);
      expect(ringFixes).toHaveLength(buttonCalls.length);
    });
  });

  describe("dialog primitive", () => {
    it("is a client component over the Base UI dialog", async () => {
      const primitive = await readSource(DIALOG_PRIMITIVE);

      expect(primitive).toMatch(/^\s*["']use client["']/);
      expect(primitive).toMatch(/from "@base-ui\/react\/dialog"/);
    });

    it("renders the popup and a backdrop in a portal", async () => {
      const primitive = await readSource(DIALOG_PRIMITIVE);

      expect(primitive).toMatch(/\.Portal\b/);
      expect(primitive).toMatch(/\.Backdrop\b/);
      expect(primitive).toMatch(/\.Popup\b/);
      expect(primitive).toMatch(/\.Title\b/);
      expect(primitive).toMatch(/\.Description\b/);
    });

    it("exports the root and the parts the dialog is built from", async () => {
      const primitive = await readSource(DIALOG_PRIMITIVE);

      const exported = [
        ...primitive.matchAll(/^export \{([^}]*)\}/gm),
      ].flatMap((match) => match[1].split(",").map((name) => name.trim()));

      expect(exported.filter(Boolean).sort()).toEqual(
        expect.arrayContaining([
          "Dialog",
          "DialogContent",
          "DialogDescription",
          "DialogTitle",
        ]),
      );
    });

    it("uses the editorial tokens: dimmed backdrop, centered hairlined paper popup", async () => {
      const primitive = await readSource(DIALOG_PRIMITIVE);

      expect(primitive).toContain("bg-black/40");
      expect(primitive).toContain("fixed inset-0");
      expect(primitive).toContain("w-[min(32rem,calc(100vw-2rem))]");
      expect(primitive).toContain("bg-paper");
      expect(primitive).toContain("border-line-strong");
      expect(primitive).toMatch(/import \{ cn \} from "@\/lib\/utils"/);
    });

    it("forwards className and the remaining props, including a controlled open", async () => {
      const primitive = await readSource(DIALOG_PRIMITIVE);

      expect(primitive).toMatch(/\bclassName\b/);
      expect(primitive).toContain("{...props}");
      // The root takes the primitive's own props, so open/onOpenChange pass through.
      expect(primitive).toMatch(/DialogPrimitive\.Root\.Props/);
    });
  });

  describe("selection bar", () => {
    it("is a client component", async () => {
      const bar = await readSource(BAR);

      expect(bar).toMatch(/^\s*["']use client["']/);
    });

    it("reads the delete quota from its route and lets the shared gate choose the action", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain("/api/posts/delete-quota");
      // The count changes with every delete, so an answer from the cache is wrong.
      expect(bar).toContain('cache: "no-store"');
      expect(bar).toMatch(
        /import \{[^}]*\bgetDeleteGate\b[^}]*\} from "@\/lib\/post-selection"/,
      );
      // The count is the selection's size, never a constant, and the import
      // flag reaches the gate: they are what keep an over-quota or importing
      // selection from being deletable.
      expect(bar).toMatch(
        /getDeleteGate\(\{\s*selectedCount: selection\.size,\s*quota,\s*isImporting,?\s*\}\)/,
      );
      // Every gate answer has its own control.
      for (const kind of ["ready", "disabled", "reconnect", "quota_error"]) {
        expect(bar).toContain(`case "${kind}"`);
      }
    });

    it("offers the delete button with the trash icon, and the reason beside it when it is disabled", async () => {
      const bar = await readSource(BAR);

      expect(bar).toMatch(
        /import \{[^}]*\bTrash\b[^}]*\} from "@phosphor-icons\/react"/,
      );
      expect(bar).toContain("Delete from Threads");
      expect(bar).toContain('variant: "destructive"');
      expect(bar).toContain("{gate.reason}");
      expect(bar).toContain('disabled={gate.kind === "disabled"}');
      // Only "ready" and "disabled" render the button. A reconnect or a failed
      // quota check has its own control instead, never a way to delete.
      expect(bar).toMatch(/case "ready":\s*case "disabled":\s*return \(/);
    });

    it("sends a user without the permission to reconnect through a plain link, not a client-side one", async () => {
      const bar = await readSource(BAR);

      expect(bar).toMatch(/<a\b[^>]*\bhref="\/api\/auth\/threads"/);
      expect(bar).toContain("Reconnect Threads to enable deleting");
      expect(bar).not.toMatch(/from "next\/link"/);
    });

    it("says when the quota check failed and offers to try again", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain("Couldn't check today's delete limit.");
      expect(bar).toContain("Try again");
      expect(bar).toContain('role="alert"');
    });

    it("looks at the quota when a selection starts, not on every change to it", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain("const hasSelection = selection.size > 0;");
      expect(bar).toMatch(
        /useEffect\(\(\) => \{\s*if \(hasSelection\) refreshQuota\(\);\s*\}, \[hasSelection, refreshQuota\]\);/,
      );
    });

    it("shows loading for a new selection and for Try again, but keeps the old answer visible after a run", async () => {
      const bar = await readSource(BAR);

      expect(bar).toMatch(/useState<QuotaState>\("loading"\)/);
      // A new selection: set while rendering, since an effect may not set
      // state, and before the request the effect starts.
      expect(bar).toMatch(
        /if \(hasSelection !== hadSelection\) \{\s*setHadSelection\(hasSelection\);\s*if \(hasSelection\) setQuota\("loading"\);\s*\}/,
      );
      // Try again.
      expect(bar).toMatch(
        /function retryQuota\(\) \{\s*setQuota\("loading"\);\s*refreshQuota\(\);\s*\}/,
      );
      expect(bar).toContain("onClick={retryQuota}");
      // After a run: the request alone, so the last answer stays until the new one.
      expect(bar).toMatch(/onFinished=\{\(\) => refreshQuota\(\)\}/);
      expect(bar.match(/setQuota\("loading"\)/g)).toHaveLength(2);
    });

    it("lets only the latest request set the quota, and nothing set it after unmount", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain("useRef(0)");
      expect(bar).toMatch(
        /if \(requestId === latestRequestRef\.current\) setQuota\(next\);/,
      );
      // One bump for each new request, one in the unmount cleanup.
      expect(bar.match(/latestRequestRef\.current \+= 1;/g)).toHaveLength(2);
    });

    it("reads anything but the two known answers as an error", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain("response.ok");
      expect(bar).toContain("permitted === false");
      expect(bar).toContain("permitted === true");
      expect(bar).toContain("Number.isFinite");
      // A rejected fetch and a body that is not JSON land in the catch.
      expect(bar).toMatch(/catch \{\s*return "error";\s*\}/);
    });

    it("renders nothing for an empty selection, yet keeps the dialog mounted while it is open", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain("if (!hasSelection && !open) return null;");
      // The dialog sits beside the strip, never inside it, so what the strip
      // depends on (the selection, the gate, the quota) cannot unmount it.
      expect(bar.match(/<BulkDeleteDialog\b/g)).toHaveLength(1);
      expect(bar).toMatch(/\) : null\}\s*<BulkDeleteDialog\b/);
    });

    it("never shows an action for an empty selection", async () => {
      const bar = await readSource(BAR);

      // The gate says "ready" for a count of 0, so the strip, and with it every
      // control, is only rendered for a non-empty selection.
      expect(bar).toMatch(/\{hasSelection \? \(\s*<div\b[^>]*role="region"/);
    });

    it("opens the dialog with a copy of the selection, set in the same handler as open", async () => {
      const bar = await readSource(BAR);

      expect(bar).toMatch(
        /import \{ BulkDeleteDialog \} from "@\/components\/dashboard\/bulk-delete-dialog"/,
      );
      expect(bar).toMatch(
        /setDialogPosts\(Array\.from\(selection\.values\(\)\)\);\s*setOpen\(true\);/,
      );
      expect(bar).toContain("onClick={openDialog}");
      expect(bar).toMatch(
        /<BulkDeleteDialog\s+open=\{open\}\s+posts=\{dialogPosts\}\s+onOpenChange=\{setOpen\}/,
      );
    });

    it("lets only the dialog close itself", async () => {
      const bar = await readSource(BAR);

      // The only call is the one that opens it. Closing arrives as
      // onOpenChange from the dialog, which refuses it while a run is in flight.
      expect(bar.match(/\bsetOpen\(/g)).toHaveLength(1);
      expect(bar).toContain("setOpen(true)");
    });

    it("labels the strip, announces the count and ties the disabled reason to the button", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain('role="region"');
      expect(bar).toContain('aria-label="Selected posts"');
      expect(bar).toContain('aria-live="polite"');
      expect(bar).toContain("useId()");
      expect(bar).toMatch(/aria-describedby=\{[^}]+\}/);
      expect(bar).toMatch(/id=\{reasonId\}/);
    });

    it("words the strip as specified", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain("`${selection.size} selected`");
      expect(bar).toMatch(/>\s*Clear\s*</);
      expect(bar).toContain("onClick={clear}");
      expect(bar).toContain("formatRemaining(quota.remaining)");
      expect(bar).toContain("1 deletion left today");
      expect(bar).toContain("`${remaining} deletions left today`");
    });

    it("styles the strip as one hairlined band above the table", async () => {
      const bar = await readSource(BAR);

      expect(bar).toContain(
        "flex flex-wrap items-center gap-3 border border-line-strong bg-paper-2 px-3 py-2 text-sm",
      );
      expect(bar).toMatch(/className="mb-3 flex flex-wrap/);
    });

    it("keeps the keyboard focus ring visible on every button, which buttonVariants' outline-none would hide", async () => {
      const bar = await readSource(BAR);

      const buttonCalls = bar.match(/buttonVariants\(/g) ?? [];
      const ringFixes = bar.match(/focus-visible:outline-solid/g) ?? [];

      expect(buttonCalls.length).toBeGreaterThan(0);
      expect(ringFixes).toHaveLength(buttonCalls.length);
    });
  });

  describe("posts page", () => {
    it("mounts the selection bar between the reselection alert and the table", async () => {
      const page = await readSource(POSTS_PAGE);

      expect(page).toMatch(
        /import \{ PostSelectionBar \} from "@\/components\/dashboard\/post-selection-bar"/,
      );
      expect(page).toContain("<PostSelectionBar isImporting={isImporting}");
      expect(page).toMatch(
        /<ReselectionAlert\b[^>]*\/>\s*<PostSelectionBar isImporting=\{isImporting\} \/>\s*<PostTable\b/,
      );
    });

    it("sends an out-of-range page back to the first page, keeping sort and filters", async () => {
      const page = await readSource(POSTS_PAGE);

      expect(page).toMatch(
        /import \{[^}]*\bgetPostsFirstPageHref\b[^}]*\} from "@\/lib\/posts-pagination"/,
      );
      expect(page).toMatch(
        /if \(page > 1 && rows\.length === 0\) \{\s*redirect\(getPostsFirstPageHref\(params\)\);\s*\}/,
      );
      // After the error return, so `rows` is known to be a list by then.
      expect(page.indexOf("redirect(getPostsFirstPageHref(params))")).toBeGreaterThan(
        page.indexOf("We couldn't load your posts right now."),
      );
    });
  });
});
