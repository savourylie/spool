import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

const DIALOG = "../../../components/dashboard/bulk-delete-dialog.tsx";
const DIALOG_PRIMITIVE = "../../../components/ui/dialog.tsx";

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
});
