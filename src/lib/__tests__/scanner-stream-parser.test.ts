import { describe, expect, it } from "vitest";

import { extractCompletedAxes } from "../scanner-stream-parser";

describe("extractCompletedAxes — completed axes", () => {
  it("returns all four axes when the accumulator is fully parsed", () => {
    const accumulator = JSON.stringify({
      styleMatch: { summary: "style summary", findings: [] },
      psychology: { summary: "psych summary", findings: [] },
      algorithm: { summary: "algo summary", findings: [] },
      aiDetection: { summary: "ai summary", findings: [] },
    });

    const result = extractCompletedAxes(accumulator);
    expect(result.styleMatch?.summary).toBe("style summary");
    expect(result.psychology?.summary).toBe("psych summary");
    expect(result.algorithm?.summary).toBe("algo summary");
    expect(result.aiDetection?.summary).toBe("ai summary");
  });

  it("extracts findings arrays on completed axes", () => {
    const accumulator = JSON.stringify({
      algorithm: {
        summary: "Check hook",
        findings: [
          { rule: "R3", severity: "warn", message: "Hook-body mismatch." },
          { severity: "info", message: "Consider citing S12." },
        ],
      },
    });
    const result = extractCompletedAxes(accumulator);
    expect(result.algorithm?.findings).toHaveLength(2);
    expect(result.algorithm?.findings[0].rule).toBe("R3");
  });
});

describe("extractCompletedAxes — partial streams", () => {
  it("returns an early axis while later axes are still streaming", () => {
    const accumulator =
      '{"styleMatch": {"summary": "done", "findings": []}, "psychology": {"summary": "still stream';
    const result = extractCompletedAxes(accumulator);
    expect(result.styleMatch?.summary).toBe("done");
    expect(result.psychology).toBeUndefined();
  });

  it("returns empty when no axis has closed yet", () => {
    const accumulator = '{"styleMatch": {"summary": "progress"';
    const result = extractCompletedAxes(accumulator);
    expect(result.styleMatch).toBeUndefined();
  });

  it("returns empty for malformed input that never opens an object", () => {
    const result = extractCompletedAxes("not json at all");
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("extractCompletedAxes — escaping and nesting", () => {
  it("handles escaped quotes in findings messages", () => {
    const accumulator = JSON.stringify({
      styleMatch: {
        summary: "She said \"hi\" and it worked",
        findings: [
          { severity: "info", message: 'Quote contains \\" escaped chars' },
        ],
      },
    });
    const result = extractCompletedAxes(accumulator);
    expect(result.styleMatch?.summary).toContain("hi");
    expect(result.styleMatch?.findings[0].severity).toBe("info");
  });

  it("handles nested arrays of finding objects", () => {
    const accumulator = JSON.stringify({
      psychology: {
        summary: "multi",
        findings: [
          { severity: "flag", message: "one" },
          { severity: "warn", message: "two" },
          { severity: "info", message: "three" },
        ],
      },
    });
    const result = extractCompletedAxes(accumulator);
    expect(result.psychology?.findings).toHaveLength(3);
  });

  it("ignores an axis key that appears inside a string value", () => {
    // "styleMatch" appears inside the algorithm axis's summary, but only as
    // part of a string — not as a top-level key. The top-level styleMatch
    // axis hasn't closed yet, so the result should omit it.
    const accumulator =
      '{"algorithm": {"summary": "See the styleMatch axis", "findings": []}, "styleMatch": {"summary": "inc';
    const result = extractCompletedAxes(accumulator);
    expect(result.algorithm?.summary).toContain("styleMatch axis");
    expect(result.styleMatch).toBeUndefined();
  });

  it("tolerates whitespace and newlines around keys and values", () => {
    const accumulator = `{
  "styleMatch"  :  {
    "summary"  :  "pretty printed",
    "findings" : []
  }
}`;
    const result = extractCompletedAxes(accumulator);
    expect(result.styleMatch?.summary).toBe("pretty printed");
  });
});

describe("extractCompletedAxes — validation", () => {
  it("rejects an axis missing the summary field", () => {
    const accumulator = '{"styleMatch": {"findings": []}}';
    const result = extractCompletedAxes(accumulator);
    expect(result.styleMatch).toBeUndefined();
  });

  it("rejects an axis with findings not an array", () => {
    const accumulator = '{"styleMatch": {"summary": "x", "findings": null}}';
    const result = extractCompletedAxes(accumulator);
    expect(result.styleMatch).toBeUndefined();
  });
});
