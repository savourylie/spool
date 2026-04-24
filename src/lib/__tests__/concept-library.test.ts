import { describe, expect, it } from "vitest";

import {
  classifyReuseRisk,
  ConceptExtractionError,
  parseAndValidateConcepts,
  REUSE_RISK_GREEN_MAX,
  REUSE_RISK_YELLOW_MAX,
} from "../concept-library";

// ── classifyReuseRisk ────────────────────────────────────────────────

describe("classifyReuseRisk", () => {
  it("returns green for 0–1 uses", () => {
    expect(classifyReuseRisk(0)).toBe("green");
    expect(classifyReuseRisk(1)).toBe("green");
  });

  it("returns yellow for 2 uses", () => {
    expect(classifyReuseRisk(2)).toBe("yellow");
  });

  it("returns red for 3+ uses", () => {
    expect(classifyReuseRisk(3)).toBe("red");
    expect(classifyReuseRisk(10)).toBe("red");
  });

  it("honors the threshold constants", () => {
    expect(classifyReuseRisk(REUSE_RISK_GREEN_MAX)).toBe("green");
    expect(classifyReuseRisk(REUSE_RISK_GREEN_MAX + 1)).toBe("yellow");
    expect(classifyReuseRisk(REUSE_RISK_YELLOW_MAX)).toBe("yellow");
    expect(classifyReuseRisk(REUSE_RISK_YELLOW_MAX + 1)).toBe("red");
  });
});

// ── parseAndValidateConcepts ─────────────────────────────────────────

describe("parseAndValidateConcepts", () => {
  it("parses a valid fenced JSON block", () => {
    const raw = '```json\n{"concepts":[{"concept":"Compound Interest","analogy":"Snowball","evidence":"It rolls downhill."}]}\n```';
    const out = parseAndValidateConcepts(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      concept: "compound interest",
      analogy: "snowball",
      evidence: "It rolls downhill.",
    });
  });

  it("parses a raw (unfenced) JSON block", () => {
    const raw = '{"concepts":[{"concept":"loss aversion","analogy":null,"evidence":"People hate losing more than they love winning."}]}';
    const out = parseAndValidateConcepts(raw);
    expect(out).toHaveLength(1);
    expect(out[0].analogy).toBeNull();
  });

  it("returns an empty array for an empty concepts list", () => {
    expect(parseAndValidateConcepts('{"concepts":[]}')).toEqual([]);
  });

  it("normalizes concept to lowercase and trims whitespace", () => {
    const raw = '{"concepts":[{"concept":"  RAINFOREST Ecosystem  ","analogy":null,"evidence":"q"}]}';
    const out = parseAndValidateConcepts(raw);
    expect(out[0].concept).toBe("rainforest ecosystem");
  });

  it("dedupes concepts within a single post and keeps the first analogy", () => {
    const raw = JSON.stringify({
      concepts: [
        { concept: "flow state", analogy: "river", evidence: "a" },
        { concept: "Flow State", analogy: "hypnosis", evidence: "b" },
      ],
    });
    const out = parseAndValidateConcepts(raw);
    expect(out).toHaveLength(1);
    expect(out[0].analogy).toBe("river");
  });

  it("drops malformed entries silently", () => {
    const raw = JSON.stringify({
      concepts: [
        { concept: "valid one", analogy: null, evidence: "ok" },
        null,
        "string-entry",
        { concept: "", analogy: null, evidence: "empty concept" },
        { analogy: null, evidence: "missing concept" },
      ],
    });
    const out = parseAndValidateConcepts(raw);
    expect(out).toHaveLength(1);
    expect(out[0].concept).toBe("valid one");
  });

  it("treats an empty-string analogy as null", () => {
    const raw = '{"concepts":[{"concept":"x","analogy":"   ","evidence":"q"}]}';
    const out = parseAndValidateConcepts(raw);
    expect(out[0].analogy).toBeNull();
  });

  it("throws on empty output", () => {
    expect(() => parseAndValidateConcepts("")).toThrow(ConceptExtractionError);
    expect(() => parseAndValidateConcepts("   ")).toThrow(ConceptExtractionError);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAndValidateConcepts("not json")).toThrow(
      ConceptExtractionError,
    );
  });

  it("throws when the top level is not an object", () => {
    expect(() => parseAndValidateConcepts("[]")).toThrow(
      ConceptExtractionError,
    );
    expect(() => parseAndValidateConcepts('"str"')).toThrow(
      ConceptExtractionError,
    );
  });

  it("throws when `concepts` is not an array", () => {
    expect(() => parseAndValidateConcepts('{"concepts":"nope"}')).toThrow(
      ConceptExtractionError,
    );
    expect(() => parseAndValidateConcepts("{}")).toThrow(
      ConceptExtractionError,
    );
  });
});
