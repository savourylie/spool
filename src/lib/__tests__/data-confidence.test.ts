import { describe, expect, it } from "vitest";
import {
  getConfidenceTier,
  type ConfidenceTier,
} from "../data-confidence";

// ---------------------------------------------------------------------------
// Tier boundaries
// ---------------------------------------------------------------------------

describe("getConfidenceTier — tier boundaries", () => {
  const cases: Array<[number, ConfidenceTier]> = [
    [0, "directional"],
    [4, "directional"],
    [5, "weak"],
    [9, "weak"],
    [10, "usable"],
    [19, "usable"],
    [20, "strong"],
    [49, "strong"],
    [50, "deep"],
    [999, "deep"],
  ];

  for (const [sample, expected] of cases) {
    it(`classifies ${sample} as ${expected}`, () => {
      expect(getConfidenceTier(sample).tier).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

describe("getConfidenceTier — labels", () => {
  it("returns a human-readable label for each tier", () => {
    expect(getConfidenceTier(0).label).toBe("Directional");
    expect(getConfidenceTier(5).label).toBe("Weak");
    expect(getConfidenceTier(10).label).toBe("Usable");
    expect(getConfidenceTier(20).label).toBe("Strong");
    expect(getConfidenceTier(50).label).toBe("Deep");
  });
});

// ---------------------------------------------------------------------------
// Suggested copy
// ---------------------------------------------------------------------------

describe("getConfidenceTier — suggestedCopy", () => {
  it("returns non-empty copy for every tier", () => {
    const samples = [0, 5, 10, 20, 50];
    for (const s of samples) {
      expect(getConfidenceTier(s).suggestedCopy.length).toBeGreaterThan(0);
    }
  });

  it("directional copy signals insufficient sample", () => {
    expect(getConfidenceTier(3).suggestedCopy).toMatch(/small|pattern/i);
  });
});

// ---------------------------------------------------------------------------
// Input sanitation
// ---------------------------------------------------------------------------

describe("getConfidenceTier — input sanitation", () => {
  it("clamps negative inputs to directional", () => {
    expect(getConfidenceTier(-5).tier).toBe("directional");
  });

  it("treats NaN as 0 (directional)", () => {
    expect(getConfidenceTier(Number.NaN).tier).toBe("directional");
  });

  it("floors fractional inputs (9.9 → weak, not usable)", () => {
    expect(getConfidenceTier(9.9).tier).toBe("weak");
  });

  it("floors fractional inputs at a tier boundary (4.9 → directional)", () => {
    expect(getConfidenceTier(4.9).tier).toBe("directional");
  });
});
