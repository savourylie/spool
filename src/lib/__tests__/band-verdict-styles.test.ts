import { describe, expect, it } from "vitest";
import {
  BAND_VERDICT_STYLES,
  type BandVerdictStyle,
} from "../band-verdict-styles";
import { BAND_VERDICTS } from "../review-sweep";

describe("BAND_VERDICT_STYLES", () => {
  it("has an entry for every verdict in BAND_VERDICTS", () => {
    for (const verdict of BAND_VERDICTS) {
      const style: BandVerdictStyle = BAND_VERDICT_STYLES[verdict];
      expect(style).toBeDefined();
      expect(style.label.length).toBeGreaterThan(0);
      expect(style.chipClass.length).toBeGreaterThan(0);
      expect(style.barClass.length).toBeGreaterThan(0);
      expect(style.leftBorderClass.length).toBeGreaterThan(0);
    }
  });

  it("maps each verdict to a distinct chip palette", () => {
    const chips = BAND_VERDICTS.map((v) => BAND_VERDICT_STYLES[v].chipClass);
    const unique = new Set(chips);
    expect(unique.size).toBe(BAND_VERDICTS.length);
  });

  it("labels read naturally for users", () => {
    expect(BAND_VERDICT_STYLES.below_conservative.label).toBe(
      "Below conservative",
    );
    expect(BAND_VERDICT_STYLES.baseline.label).toBe("Baseline");
    expect(BAND_VERDICT_STYLES.above_optimistic.label).toBe(
      "Above optimistic",
    );
  });
});
