import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("dashboard layout overflow source", () => {
  it("lets the main column shrink below its content, so a wide table scrolls inside it", async () => {
    const source = await readFile(
      new URL("../layout.tsx", import.meta.url),
      "utf8",
    );

    // A flex item's minimum width defaults to its content's width, so without
    // min-w-0 the column grows to fit the Posts table and the whole page
    // scrolls sideways instead of the table.
    const mainClassName = source.match(/<main\b[^>]*\bclassName="([^"]*)"/)?.[1];
    expect(mainClassName).toBeDefined();
    expect(mainClassName?.split(/\s+/)).toContain("min-w-0");
  });

  it("keeps the Posts table's absolutely positioned content inside its scroll wrapper", async () => {
    const source = await readFile(
      new URL("../../../components/dashboard/post-table.tsx", import.meta.url),
      "utf8",
    );

    // An absolutely positioned element, such as the sr-only "(top performer)"
    // span in the WES cell, is placed against its nearest positioned ancestor.
    // Unless the scroll wrapper itself is positioned, that ancestor is outside
    // the wrapper, so overflow-x-auto does not clip the span and it widens the
    // whole page.
    const wrapperClassName = source.match(
      /<div\b[^>]*\bclassName="([^"]*)"[^>]*>\s*<table\b/,
    )?.[1];
    expect(wrapperClassName).toBeDefined();
    expect(wrapperClassName?.split(/\s+/)).toEqual(
      expect.arrayContaining(["relative", "overflow-x-auto"]),
    );
  });
});
