import { describe, expect, it } from "vitest";
import {
  formatRemaining,
  getDeleteGate,
  getDialogPreviewLines,
  getPageSelectionState,
  getPostSelectLabel,
  readQuota,
  removeFromSelection,
  setPageSelected,
  togglePost,
  type PostSelection,
  type QuotaState,
  type SelectedPost,
} from "../post-selection";

function post(
  id: string,
  preview: string | null = `Preview ${id}`,
): SelectedPost {
  return { id, preview };
}

function selectionOf(...posts: SelectedPost[]): PostSelection {
  return new Map<string, SelectedPost>(posts.map((p) => [p.id, p]));
}

function idsOf(selection: PostSelection): string[] {
  return Array.from(selection.keys());
}

function entriesOf(selection: PostSelection) {
  return Array.from(selection.entries());
}

function quotaWith(remaining: number): QuotaState {
  return { permitted: true, used: 100 - remaining, total: 100, remaining };
}

describe("togglePost", () => {
  it("adds a post that is not selected", () => {
    const next = togglePost(selectionOf(), post("a"));

    expect(idsOf(next)).toEqual(["a"]);
    expect(next.get("a")).toEqual(post("a"));
  });

  it("removes a post that is already selected", () => {
    const next = togglePost(selectionOf(post("a"), post("b")), post("a"));

    expect(idsOf(next)).toEqual(["b"]);
  });

  it("adds then removes the same post when toggled twice", () => {
    const added = togglePost(selectionOf(), post("a"));
    const removed = togglePost(added, post("a"));

    expect(idsOf(added)).toEqual(["a"]);
    expect(idsOf(removed)).toEqual([]);
  });

  it("appends a newly selected post at the end, so insertion order is selection order", () => {
    const selection = selectionOf(post("a"), post("b"));

    expect(idsOf(togglePost(selection, post("c")))).toEqual(["a", "b", "c"]);

    // A post that was deselected and picked again goes to the end.
    const reselected = togglePost(togglePost(selection, post("a")), post("a"));
    expect(idsOf(reselected)).toEqual(["b", "a"]);
  });

  it("never mutates its input and always returns a new Map", () => {
    const selection = selectionOf(post("a"), post("b"));
    const before = entriesOf(selection);

    const added = togglePost(selection, post("c"));
    const removed = togglePost(selection, post("a"));

    expect(added).not.toBe(selection);
    expect(removed).not.toBe(selection);
    expect(entriesOf(selection)).toEqual(before);
  });
});

describe("setPageSelected", () => {
  it("selects every post on the page, in page order", () => {
    const page = [post("c"), post("a"), post("b")];

    const next = setPageSelected(selectionOf(), page, true);

    expect(idsOf(next)).toEqual(["c", "a", "b"]);
    expect(next.get("a")).toEqual(post("a"));
  });

  it("keeps posts already selected from other pages", () => {
    const selection = selectionOf(post("x"), post("y"));

    const next = setPageSelected(selection, [post("a"), post("b")], true);

    expect(idsOf(next)).toEqual(["x", "y", "a", "b"]);
  });

  it("appends only the page posts that are not selected yet, leaving existing entries as they are", () => {
    const selection = selectionOf(post("b", "Original b"), post("x"));
    const page = [post("a"), post("b", "Changed b"), post("c")];

    const next = setPageSelected(selection, page, true);

    // "b" keeps its position and its original preview.
    expect(idsOf(next)).toEqual(["b", "x", "a", "c"]);
    expect(next.get("b")).toEqual({ id: "b", preview: "Original b" });
  });

  it("removes only the page's ids when deselecting", () => {
    const selection = selectionOf(post("a"), post("x"), post("b"), post("y"));
    const page = [post("a"), post("b"), post("c")];

    const next = setPageSelected(selection, page, false);

    expect(idsOf(next)).toEqual(["x", "y"]);
  });

  it("never mutates its input and always returns a new Map", () => {
    const selection = selectionOf(post("a"), post("x"));
    const before = entriesOf(selection);
    const page = [post("a"), post("b")];

    const selected = setPageSelected(selection, page, true);
    const deselected = setPageSelected(selection, page, false);

    expect(selected).not.toBe(selection);
    expect(deselected).not.toBe(selection);
    expect(entriesOf(selection)).toEqual(before);
  });

  it("returns a new Map even when nothing changes", () => {
    const selection = selectionOf(post("a"), post("b"));

    const alreadySelected = setPageSelected(
      selection,
      [post("a"), post("b")],
      true,
    );
    const nothingToRemove = setPageSelected(selection, [post("z")], false);

    expect(alreadySelected).not.toBe(selection);
    expect(entriesOf(alreadySelected)).toEqual(entriesOf(selection));
    expect(nothingToRemove).not.toBe(selection);
    expect(entriesOf(nothingToRemove)).toEqual(entriesOf(selection));
  });
});

describe("getPageSelectionState", () => {
  const pageIds = ["a", "b", "c"];

  it("is none when no post on the page is selected", () => {
    expect(getPageSelectionState(selectionOf(), pageIds)).toBe("none");
    expect(
      getPageSelectionState(selectionOf(post("x"), post("y")), pageIds),
    ).toBe("none");
  });

  it("is some when only part of the page is selected", () => {
    expect(getPageSelectionState(selectionOf(post("b")), pageIds)).toBe(
      "some",
    );
    expect(
      getPageSelectionState(selectionOf(post("a"), post("c")), pageIds),
    ).toBe("some");
  });

  it("is all when every post on the page is selected, whatever else is selected", () => {
    expect(
      getPageSelectionState(
        selectionOf(post("a"), post("b"), post("c")),
        pageIds,
      ),
    ).toBe("all");
    expect(
      getPageSelectionState(
        selectionOf(post("x"), post("c"), post("b"), post("a")),
        pageIds,
      ),
    ).toBe("all");
  });

  it("is none for an empty page, even when other posts are selected", () => {
    expect(getPageSelectionState(selectionOf(), [])).toBe("none");
    expect(getPageSelectionState(selectionOf(post("x")), [])).toBe("none");
  });
});

describe("removeFromSelection", () => {
  it("removes the given ids and keeps the rest in selection order", () => {
    const selection = selectionOf(post("a"), post("b"), post("c"), post("d"));

    const next = removeFromSelection(selection, ["b", "d"]);

    expect(idsOf(next)).toEqual(["a", "c"]);
  });

  it("accepts any iterable of ids", () => {
    const selection = selectionOf(post("a"), post("b"), post("c"));

    expect(idsOf(removeFromSelection(selection, new Set(["a", "c"])))).toEqual(
      ["b"],
    );
    expect(idsOf(removeFromSelection(selection, new Set<string>()))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("ignores ids that are not selected but still returns a new Map", () => {
    const selection = selectionOf(post("a"), post("b"));

    const next = removeFromSelection(selection, ["z"]);

    expect(next).not.toBe(selection);
    expect(entriesOf(next)).toEqual(entriesOf(selection));
  });

  it("never mutates its input", () => {
    const selection = selectionOf(post("a"), post("b"));
    const before = entriesOf(selection);

    const next = removeFromSelection(selection, ["a"]);

    expect(next).not.toBe(selection);
    expect(entriesOf(selection)).toEqual(before);
  });
});

describe("getDeleteGate", () => {
  const IMPORTING_REASON = "Deleting is paused while posts are importing.";

  it.each<[string, number, QuotaState]>([
    ["the quota is loading", 3, "loading"],
    ["the quota check failed", 3, "error"],
    ["delete is not permitted", 3, { permitted: false }],
    ["deletions remain", 3, quotaWith(97)],
    ["more posts are selected than deletions remain", 3, quotaWith(2)],
  ])(
    "is disabled while posts are importing, ahead of everything else (%s)",
    (_case, selectedCount, quota) => {
      expect(getDeleteGate({ selectedCount, quota, isImporting: true })).toEqual(
        { kind: "disabled", reason: IMPORTING_REASON },
      );
    },
  );

  it("is disabled while the quota is loading", () => {
    expect(
      getDeleteGate({ selectedCount: 1, quota: "loading", isImporting: false }),
    ).toEqual({ kind: "disabled", reason: "Checking today's delete limit…" });
  });

  it("reports a quota error when the quota check failed", () => {
    expect(
      getDeleteGate({ selectedCount: 1, quota: "error", isImporting: false }),
    ).toEqual({ kind: "quota_error" });
  });

  it("asks to reconnect when delete is not permitted", () => {
    expect(
      getDeleteGate({
        selectedCount: 1,
        quota: { permitted: false },
        isImporting: false,
      }),
    ).toEqual({ kind: "reconnect" });
  });

  it("is disabled when more posts are selected than deletions remain", () => {
    expect(
      getDeleteGate({
        selectedCount: 98,
        quota: quotaWith(97),
        isImporting: false,
      }),
    ).toEqual({
      kind: "disabled",
      reason: "You can delete 97 more posts today.",
    });
  });

  it("uses the singular when one deletion remains", () => {
    expect(
      getDeleteGate({
        selectedCount: 2,
        quota: quotaWith(1),
        isImporting: false,
      }),
    ).toEqual({
      kind: "disabled",
      reason: "You can delete 1 more post today.",
    });
  });

  it("says the limit is reached when no deletions remain", () => {
    expect(
      getDeleteGate({
        selectedCount: 1,
        quota: quotaWith(0),
        isImporting: false,
      }),
    ).toEqual({
      kind: "disabled",
      reason: "You've reached today's delete limit.",
    });
  });

  it("is ready when the selection fits within the remaining deletions", () => {
    expect(
      getDeleteGate({
        selectedCount: 3,
        quota: quotaWith(97),
        isImporting: false,
      }),
    ).toEqual({ kind: "ready" });
  });

  it("is ready when the selection uses exactly the remaining deletions", () => {
    expect(
      getDeleteGate({
        selectedCount: 3,
        quota: quotaWith(3),
        isImporting: false,
      }),
    ).toEqual({ kind: "ready" });
  });
});

describe("readQuota", () => {
  it("returns either answer the route sends as it is", () => {
    expect(readQuota({ permitted: false })).toEqual({ permitted: false });
    expect(
      readQuota({ permitted: true, used: 3, total: 100, remaining: 97 }),
    ).toEqual({ permitted: true, used: 3, total: 100, remaining: 97 });
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["an array", [{ permitted: false }]],
    ["a string", '{"permitted":false}'],
    ["a NaN count", { permitted: true, used: NaN, total: 100, remaining: 97 }],
    [
      "an infinite count",
      { permitted: true, used: 3, total: Infinity, remaining: 97 },
    ],
    ["a missing count", { permitted: true, used: 3, total: 100 }],
    [
      'permitted: "true"',
      { permitted: "true", used: 3, total: 100, remaining: 97 },
    ],
  ])("reads %s as an error", (_case, body) => {
    expect(readQuota(body)).toBe("error");
  });
});

describe("formatRemaining", () => {
  it.each([
    [0, "0 deletions left today"],
    [1, "1 deletion left today"],
    [2, "2 deletions left today"],
  ])("words %i remaining", (remaining, text) => {
    expect(formatRemaining(remaining)).toBe(text);
  });
});

describe("getDialogPreviewLines", () => {
  const sevenPosts = Array.from({ length: 7 }, (_, index) =>
    post(`p${index + 1}`, `Preview ${index + 1}`),
  );

  it("lists the first five previews and counts the rest", () => {
    expect(getDialogPreviewLines(sevenPosts)).toEqual({
      lines: [
        "Preview 1",
        "Preview 2",
        "Preview 3",
        "Preview 4",
        "Preview 5",
      ],
      moreCount: 2,
    });
  });

  it("lists every preview when there are no more than five", () => {
    expect(getDialogPreviewLines(sevenPosts.slice(0, 3))).toEqual({
      lines: ["Preview 1", "Preview 2", "Preview 3"],
      moreCount: 0,
    });
    expect(getDialogPreviewLines(sevenPosts.slice(0, 5))).toEqual({
      lines: [
        "Preview 1",
        "Preview 2",
        "Preview 3",
        "Preview 4",
        "Preview 5",
      ],
      moreCount: 0,
    });
  });

  it("returns nothing for no posts", () => {
    expect(getDialogPreviewLines([])).toEqual({ lines: [], moreCount: 0 });
  });

  it("shows a dash for a post without a preview", () => {
    const posts = [
      post("a", "First"),
      post("b", null),
      post("c", ""),
      post("d", "   \n\t "),
      post("e", "Fifth"),
    ];

    expect(getDialogPreviewLines(posts).lines).toEqual([
      "First",
      "—",
      "—",
      "—",
      "Fifth",
    ]);
  });

  it("passes a non-blank preview through unchanged", () => {
    expect(
      getDialogPreviewLines([post("a", "  Padded  preview…  ")]).lines,
    ).toEqual(["  Padded  preview…  "]);
  });

  it("honours a custom limit", () => {
    expect(getDialogPreviewLines(sevenPosts, 3)).toEqual({
      lines: ["Preview 1", "Preview 2", "Preview 3"],
      moreCount: 4,
    });
  });

  it("does not mutate the posts it is given", () => {
    const posts = [...sevenPosts];

    getDialogPreviewLines(posts);

    expect(posts).toEqual(sevenPosts);
  });
});

describe("getPostSelectLabel", () => {
  const date = "Nov 3, 2026";

  it.each<[string, string | null]>([
    ["null", null],
    ["empty", ""],
    ["whitespace-only", "  \n\t "],
  ])("names a post by its date when the preview is %s", (_case, preview) => {
    expect(getPostSelectLabel(preview, date)).toBe(
      "Select post from Nov 3, 2026",
    );
  });

  it("names a post with short text by the whole text, trimmed", () => {
    expect(getPostSelectLabel("  Hello world  ", date)).toBe(
      "Select post: Hello world",
    );
  });

  it("keeps text of exactly 60 characters whole", () => {
    const text = "a".repeat(60);

    expect(getPostSelectLabel(text, date)).toBe(`Select post: ${text}`);
  });

  it("cuts longer text to its first 60 characters and marks the cut", () => {
    expect(getPostSelectLabel(`${"a".repeat(60)}bcd`, date)).toBe(
      `Select post: ${"a".repeat(60)}…`,
    );
    // A cut that ends on a space does not leave it before the mark.
    expect(getPostSelectLabel(`${"a".repeat(59)} bcd`, date)).toBe(
      `Select post: ${"a".repeat(59)}…`,
    );
  });

  it("cuts between characters, never inside an emoji", () => {
    expect(getPostSelectLabel(`${"a".repeat(59)}😀 tail`, date)).toBe(
      `Select post: ${"a".repeat(59)}😀…`,
    );
  });

  it("collapses newlines and runs of whitespace inside the text", () => {
    expect(
      getPostSelectLabel("First line\n\nsecond\tline   here", date),
    ).toBe("Select post: First line second line here");
  });
});
