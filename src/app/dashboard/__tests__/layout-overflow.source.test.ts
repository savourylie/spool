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
});
