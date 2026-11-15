import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

const LAYOUT = "../posts/layout.tsx";
const PROVIDER = "../../../components/dashboard/post-selection-provider.tsx";
const CHECKBOX = "../../../components/ui/checkbox.tsx";
const TABLE = "../../../components/dashboard/post-table.tsx";

describe("posts selection source", () => {
  describe("posts layout", () => {
    it("renders the selection provider around the page and nothing else", async () => {
      const layout = await readSource(LAYOUT);

      expect(layout).toContain("export default function PostsLayout");
      expect(layout).toMatch(
        /<PostSelectionProvider>\s*\{children\}\s*<\/PostSelectionProvider>/,
      );
      // The provider is the only element, so the page looks exactly as before.
      expect(layout.match(/<[A-Za-z]/g)).toHaveLength(1);
    });

    it("stays a server component so the selection survives page, sort and filter navigation", async () => {
      const layout = await readSource(LAYOUT);

      expect(layout).not.toMatch(/["']use client["']/);
    });
  });

  describe("selection provider", () => {
    it("is a client component", async () => {
      const provider = await readSource(PROVIDER);

      expect(provider).toMatch(/^\s*["']use client["']/);
    });

    it("keeps the selection in state behind stable functional updates", async () => {
      const provider = await readSource(PROVIDER);

      expect(provider).toContain("useState");
      expect(provider).toContain("useCallback");
      // toggle, setPage and remove all update from the previous selection.
      expect(provider.match(/setSelection\(\(\w+\) =>/g)).toHaveLength(3);
      expect(provider).toMatch(/setSelection\(new Map\(\)\)/);
    });

    it("throws a clear error when the hook is used outside the provider", async () => {
      const provider = await readSource(PROVIDER);

      expect(provider).toMatch(
        /throw new Error\(\s*["'`][^"'`]*PostSelectionProvider/,
      );
    });

    it("exports only the provider and the hook", async () => {
      const provider = await readSource(PROVIDER);

      const exported = [
        ...provider.matchAll(
          /^export (?:async )?(?:function|const|let|class|type|interface) (\w+)/gm,
        ),
      ].map((match) => match[1]);

      expect(exported.sort()).toEqual([
        "PostSelectionProvider",
        "usePostSelection",
      ]);
      expect(provider).not.toMatch(/^export (?:default|\{)/m);
    });
  });

  describe("checkbox primitive", () => {
    it("wraps the Base UI checkbox with the project's tokens and icons", async () => {
      const checkbox = await readSource(CHECKBOX);

      expect(checkbox).toMatch(/from "@base-ui\/react\/checkbox"/);
      expect(checkbox).toMatch(/\.Root\b/);
      expect(checkbox).toMatch(/\.Indicator\b/);
      expect(checkbox).toMatch(
        /import \{[^}]*\bCheck\b[^}]*\} from "@phosphor-icons\/react"/,
      );
      expect(checkbox).toMatch(
        /import \{[^}]*\bMinus\b[^}]*\} from "@phosphor-icons\/react"/,
      );
      expect(checkbox).toMatch(/import \{ cn \} from "@\/lib\/utils"/);
      expect(checkbox).toContain("rounded-[var(--radius-sm)]");
      expect(checkbox).toContain("focus-visible:outline-[var(--accent)]");
    });

    it("draws its focus ring, which a base outline-none would switch off", async () => {
      const checkbox = await readSource(CHECKBOX);

      // In Tailwind 4, outline-none sets the outline style to none for good, so
      // focus-visible:outline-2 would then draw nothing.
      expect(checkbox).not.toMatch(/(?:^|[\s"'`])outline-none\b/);
    });

    it("forwards className and the remaining props, aria-label included, to the root", async () => {
      const checkbox = await readSource(CHECKBOX);

      expect(checkbox).toMatch(/\bclassName\b/);
      expect(checkbox).toContain("{...props}");
      expect(checkbox).toContain("indeterminate");
    });
  });

  describe("post table", () => {
    it("reads the shared selection and renders the Checkbox primitive", async () => {
      const table = await readSource(TABLE);

      expect(table).toMatch(
        /import \{[^}]*\busePostSelection\b[^}]*\} from "\.\/post-selection-provider"/,
      );
      expect(table).toMatch(
        /import \{[^}]*\bCheckbox\b[^}]*\} from "@\/components\/ui\/checkbox"/,
      );
      expect(table).toContain("getPageSelectionState");
    });

    it("adds a leading column, so every colSpan counts it", async () => {
      const table = await readSource(TABLE);

      expect(table).toContain("COLUMN_COUNT = COLUMNS.length + 1");
      // The expanded-detail row and the empty-state row.
      expect(table.match(/colSpan=\{COLUMN_COUNT\}/g)).toHaveLength(2);
    });

    it("gives the header checkbox an accessible name, a mixed state and a disabled empty page", async () => {
      const table = await readSource(TABLE);

      expect(table).toContain('aria-label="Select all posts on this page"');
      expect(table).toMatch(/indeterminate=\{\w+ === "some"\}/);
      expect(table).toMatch(/checked=\{\w+ === "all"\}/);
      expect(table).toContain("disabled={posts.length === 0}");
    });

    it("selects the rest of a partly selected page and clears a fully selected one", async () => {
      const table = await readSource(TABLE);

      expect(table).toMatch(/setPage\(\w+, \w+ !== "all"\)/);
    });

    it("labels each row checkbox as a post selection", async () => {
      const table = await readSource(TABLE);

      expect(table).toMatch(/aria-label=\{`Select post[^`]*`\}/);
    });

    it("keeps each selected post's id and text preview", async () => {
      const table = await readSource(TABLE);

      // One entry per row on toggle, and the same shape for the whole page.
      expect(table.match(/preview: \w+\.text_preview/g)).toHaveLength(2);
    });

    it("stops row-expanding clicks and key presses at the checkbox cell", async () => {
      const table = await readSource(TABLE);

      expect(table).toContain("stopPropagation");
      expect(table).toMatch(/onClick=\{\((\w+)\) => \1\.stopPropagation\(\)\}/);
      expect(table).toMatch(
        /onKeyDown=\{\((\w+)\) => \1\.stopPropagation\(\)\}/,
      );
    });
  });
});
