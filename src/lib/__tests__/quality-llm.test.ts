import { describe, expect, it } from "vitest";
import {
  buildScannerPrompt,
  buildScannerPromptV2,
  parseAndValidateResponse,
  parseAndValidateResponseV2,
  type UserContext,
} from "../quality-llm";
import { flattenSystemBlocks } from "../llm-client";
import {
  BRAND_VOICE_DIMENSIONS,
  type BrandVoiceProfile,
  type BrandVoiceRecord,
} from "../brand-voice-types";
import type { NeighborPost } from "../quality-scanner-shared";

// ── Fixtures ──────────────────────────────────────────────────────────

const EMPTY_CONTEXT: UserContext = {
  recentPosts: [],
  topicTags: [],
};

const FULL_CONTEXT: UserContext = {
  recentPosts: [
    { text: "AI is changing everything in tech.", publishedAt: "2026-03-20T10:00:00Z" },
    { text: "Hot take: most productivity advice is recycled.", publishedAt: "2026-03-18T08:00:00Z" },
  ],
  topicTags: ["tech", "productivity", "AI"],
};

// ── Brand Voice Fixtures (TICKET-070) ─────────────────────────────────

function buildProfile(): BrandVoiceProfile {
  const profile = {} as BrandVoiceProfile;
  for (const [i, dim] of BRAND_VOICE_DIMENSIONS.entries()) {
    profile[dim] = {
      pattern: `Pattern for ${dim} dimension number ${i}.`,
      evidence: [
        { postId: `post-${i}-a`, excerpt: `Example excerpt A for ${dim}` },
        { postId: `post-${i}-b`, excerpt: `Example excerpt B for ${dim}` },
      ],
    };
  }
  return profile;
}

const STUB_BRAND_VOICE: BrandVoiceRecord = {
  profile: buildProfile(),
  sourcePostCount: 0,
  confidenceTier: "directional",
  updatedAt: "2026-04-23T00:00:00Z",
};

const USABLE_BRAND_VOICE: BrandVoiceRecord = {
  profile: buildProfile(),
  sourcePostCount: 12,
  confidenceTier: "usable",
  updatedAt: "2026-04-23T00:00:00Z",
};

const VALID_RESPONSE = JSON.stringify({
  issues: [
    {
      id: "ai-tone-detected",
      severity: "medium",
      category: "tone",
      description: "Post sounds AI-generated",
      suggestion: "Add personal anecdotes or casual language",
    },
  ],
  rewrites: [
    {
      label: "More conversational tone",
      text: "Here is the rewritten post text...",
    },
  ],
  shareability: {
    score: 45,
    topTrigger: "voice of the reader",
    reasoning: "The post articulates a common frustration but lacks specificity.",
  },
  tone: "Formal and slightly generic, like a LinkedIn post.",
});

// ── buildScannerPrompt ────────────────────────────────────────────────

describe("buildScannerPrompt", () => {
  it("includes recent posts in the system prompt", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", FULL_CONTEXT);
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("AI is changing everything in tech.");
    expect(joined).toContain("most productivity advice is recycled.");
  });

  it("includes topic tags in the system prompt", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", FULL_CONTEXT);
    expect(flattenSystemBlocks(systemPrompt)).toContain("tech, productivity, AI");
  });

  it("handles empty recent posts gracefully", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", EMPTY_CONTEXT);
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("No recent posts available.");
    expect(joined).not.toContain("undefined");
  });

  it("handles empty topic tags gracefully", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", EMPTY_CONTEXT);
    expect(flattenSystemBlocks(systemPrompt)).toContain("No established topics yet.");
  });

  it("includes the draft text in the user message", () => {
    const { userMessage } = buildScannerPrompt("Check out my awesome post!", EMPTY_CONTEXT);
    expect(userMessage).toContain("Check out my awesome post!");
  });

  it("numbers recent posts with dates", () => {
    const { systemPrompt } = buildScannerPrompt("Draft", FULL_CONTEXT);
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("1. [2026-03-20T10:00:00Z]");
    expect(joined).toContain("2. [2026-03-18T08:00:00Z]");
  });

  it("marks the knowledge prefix as cacheable and the user suffix as uncached", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", FULL_CONTEXT);
    expect(systemPrompt.length).toBeGreaterThanOrEqual(2);
    expect(systemPrompt[0].cacheable).toBe(true);
    // The block containing per-user data must not be cacheable
    const variableBlock = systemPrompt.find((b) =>
      b.text.includes("AI is changing everything in tech."),
    );
    expect(variableBlock).toBeDefined();
    expect(variableBlock?.cacheable).toBeFalsy();
  });

  // ── Brand Voice Observer (TICKET-070) ────────────────────────────────

  it("does NOT inject observer block when brandVoice is absent", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", FULL_CONTEXT);
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).not.toContain("User's established voice");
  });

  it("does NOT inject observer block for the empty-corpus stub profile", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", {
      ...FULL_CONTEXT,
      brandVoice: STUB_BRAND_VOICE,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).not.toContain("User's established voice");
  });

  it("injects the observer block with 'flag drift only' phrasing when profile is non-stub", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", {
      ...FULL_CONTEXT,
      brandVoice: USABLE_BRAND_VOICE,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("User's established voice (flag drift only — do not rewrite toward this)");
    expect(joined).toContain("Pattern for sentence_structure");
  });

  it("injects the observer block as an uncached SystemBlock", () => {
    const { systemPrompt } = buildScannerPrompt("My draft post", {
      ...FULL_CONTEXT,
      brandVoice: USABLE_BRAND_VOICE,
    });
    const observerBlock = systemPrompt.find((b) =>
      b.text.includes("User's established voice (flag drift only"),
    );
    expect(observerBlock).toBeDefined();
    expect(observerBlock?.cacheable).toBeFalsy();
  });
});

// ── parseAndValidateResponse ──────────────────────────────────────────

describe("parseAndValidateResponse", () => {
  it("parses a valid JSON response", () => {
    const result = parseAndValidateResponse(VALID_RESPONSE);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].id).toBe("ai-tone-detected");
    expect(result.issues[0].severity).toBe("medium");
    expect(result.issues[0].category).toBe("tone");
    expect(result.rewrites).toHaveLength(1);
    expect(result.shareability.score).toBe(45);
    expect(result.tone).toContain("Formal");
  });

  it("strips markdown code fences", () => {
    const fenced = "```json\n" + VALID_RESPONSE + "\n```";
    const result = parseAndValidateResponse(fenced);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe("tone");
  });

  it("strips code fences without language tag", () => {
    const fenced = "```\n" + VALID_RESPONSE + "\n```";
    const result = parseAndValidateResponse(fenced);
    expect(result.issues).toHaveLength(1);
  });

  it("defaults missing rewrites to empty array", () => {
    const partial = JSON.stringify({
      issues: [],
      shareability: { score: 80, topTrigger: "none", reasoning: "Good post." },
      tone: "Casual",
    });
    const result = parseAndValidateResponse(partial);
    expect(result.rewrites).toEqual([]);
  });

  it("defaults missing shareability to zero score", () => {
    const partial = JSON.stringify({
      issues: [],
      rewrites: [],
      tone: "Casual",
    });
    const result = parseAndValidateResponse(partial);
    expect(result.shareability).toEqual({
      score: 0,
      topTrigger: "none",
      reasoning: "",
    });
  });

  it("defaults missing tone to empty string", () => {
    const partial = JSON.stringify({
      issues: [],
      rewrites: [],
      shareability: { score: 50, topTrigger: "none", reasoning: "OK" },
    });
    const result = parseAndValidateResponse(partial);
    expect(result.tone).toBe("");
  });

  it("filters issues with invalid severity", () => {
    const bad = JSON.stringify({
      issues: [
        { id: "good", severity: "high", category: "tone", description: "OK", suggestion: "OK" },
        { id: "bad", severity: "critical", category: "tone", description: "Bad", suggestion: "Bad" },
      ],
      rewrites: [],
      shareability: { score: 0, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    const result = parseAndValidateResponse(bad);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].id).toBe("good");
  });

  it("filters issues with invalid category", () => {
    const bad = JSON.stringify({
      issues: [
        { id: "valid", severity: "low", category: "coherence", description: "OK", suggestion: "OK" },
        { id: "invalid", severity: "low", category: "clickbait", description: "Bad", suggestion: "Bad" },
      ],
      rewrites: [],
      shareability: { score: 0, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    const result = parseAndValidateResponse(bad);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].id).toBe("valid");
  });

  it("generates IDs for issues missing them", () => {
    const noIds = JSON.stringify({
      issues: [
        { severity: "medium", category: "similarity", description: "Too similar", suggestion: "Change it" },
      ],
      rewrites: [],
      shareability: { score: 0, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    const result = parseAndValidateResponse(noIds);
    expect(result.issues[0].id).toBe("llm-similarity-0");
  });

  it("clamps shareability score to 0-100", () => {
    const over = JSON.stringify({
      issues: [],
      rewrites: [],
      shareability: { score: 150, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    expect(parseAndValidateResponse(over).shareability.score).toBe(100);

    const under = JSON.stringify({
      issues: [],
      rewrites: [],
      shareability: { score: -10, topTrigger: "none", reasoning: "" },
      tone: "",
    });
    expect(parseAndValidateResponse(under).shareability.score).toBe(0);
  });

  it("throws on completely invalid JSON", () => {
    expect(() => parseAndValidateResponse("not json at all")).toThrow();
  });

  it("handles issues as non-array gracefully", () => {
    const bad = JSON.stringify({
      issues: "not an array",
      rewrites: [],
      shareability: { score: 50, topTrigger: "none", reasoning: "" },
      tone: "OK",
    });
    const result = parseAndValidateResponse(bad);
    expect(result.issues).toEqual([]);
  });

  it("accepts voice-drift as a valid LLM category (TICKET-070)", () => {
    const withDrift = JSON.stringify({
      issues: [
        {
          id: "voice-drift-sentence-length",
          severity: "medium",
          category: "voice-drift",
          description: "Draft uses 40-word sentences; established pattern is short fragments.",
          suggestion: "Break into shorter sentences.",
        },
      ],
      rewrites: [],
      shareability: { score: 50, topTrigger: "none", reasoning: "" },
      tone: "OK",
    });
    const result = parseAndValidateResponse(withDrift);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe("voice-drift");
    expect(result.issues[0].id).toBe("voice-drift-sentence-length");
  });
});

// ─────────────────────────────────────────────────────────────────────
// TICKET-077 — v2 four-axis diagnostic
// ─────────────────────────────────────────────────────────────────────

const EMPTY_NEIGHBORS: NeighborPost[] = [];

const THREE_NEIGHBORS: NeighborPost[] = [
  {
    id: "n-1",
    textPreview: "Productivity advice is mostly recycled.",
    wes: 120,
    wesNormalized: 12,
    publishedAt: "2026-03-12T10:00:00Z",
  },
  {
    id: "n-2",
    textPreview: "The best workflow is the one you actually follow.",
    wes: 80,
    wesNormalized: 8,
    publishedAt: "2026-03-08T10:00:00Z",
  },
  {
    id: "n-3",
    textPreview: "Morning routines are overrated.",
    wes: 45,
    wesNormalized: 4.5,
    publishedAt: "2026-03-01T10:00:00Z",
  },
];

const VALID_V2_RESPONSE = JSON.stringify({
  styleMatch: {
    summary: "Draft departs from the user's usual fragment-heavy style.",
    findings: [
      {
        rule: "sentence_structure",
        severity: "flag",
        message: "Draft uses 30-word compound sentences; pattern is short fragments.",
        evidence: "Neighbor post [1] opens with a 6-word hook.",
      },
    ],
    neighborCitations: [1, 2],
  },
  psychology: {
    summary: "Hook is soft; no Information Gap.",
    findings: [
      {
        severity: "info",
        message: "Opener does not commit to Information Gap or Zeigarnik.",
      },
    ],
  },
  algorithm: {
    summary: "One red line hit.",
    findings: [
      {
        rule: "R1",
        severity: "warn",
        message: "Engagement bait detected.",
        evidence: "\"like if you agree\"",
      },
    ],
  },
  aiDetection: {
    summary: "AI-tone marker extraction coming in a follow-up release.",
    findings: [],
  },
});

// ── buildScannerPromptV2 ─────────────────────────────────────────────

describe("buildScannerPromptV2", () => {
  it("marks the knowledge prefix as cacheable and the variable block as uncached", () => {
    const { systemPrompt } = buildScannerPromptV2(
      "My draft",
      FULL_CONTEXT,
      EMPTY_NEIGHBORS,
    );
    expect(systemPrompt.length).toBeGreaterThanOrEqual(2);
    expect(systemPrompt[0].cacheable).toBe(true);
    expect(systemPrompt[1].cacheable).toBeFalsy();
  });

  it("includes all four knowledge files + analyze.md in the cached prefix", () => {
    const { systemPrompt } = buildScannerPromptV2(
      "My draft",
      FULL_CONTEXT,
      EMPTY_NEIGHBORS,
    );
    const prefix = systemPrompt[0].text;
    // Each knowledge file has a distinctive heading; presence confirms ordering.
    expect(prefix).toContain("Threads Algorithm Reference");
    expect(prefix).toContain("Psychology Reference");
    expect(prefix.toLowerCase()).toContain("ai"); // ai-detection.md header varies; keyword is sufficient
    expect(prefix).toContain("Scanner Four-Axis Diagnostic");
  });

  it("numbers neighbor candidates in the variable suffix", () => {
    const { systemPrompt } = buildScannerPromptV2(
      "Draft",
      FULL_CONTEXT,
      THREE_NEIGHBORS,
    );
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("Neighbor post [1]");
    expect(joined).toContain("Neighbor post [2]");
    expect(joined).toContain("Neighbor post [3]");
    expect(joined).toContain("Productivity advice is mostly recycled.");
  });

  it("handles empty neighbor list gracefully", () => {
    const { systemPrompt } = buildScannerPromptV2(
      "Draft",
      FULL_CONTEXT,
      EMPTY_NEIGHBORS,
    );
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("No neighbor posts available");
    expect(joined).not.toContain("Neighbor post [1]");
  });

  it("includes the draft text in the user message with v2 framing", () => {
    const { userMessage } = buildScannerPromptV2(
      "Check out my draft!",
      EMPTY_CONTEXT,
      EMPTY_NEIGHBORS,
    );
    expect(userMessage).toContain("four-axis diagnostic");
    expect(userMessage).toContain("Check out my draft!");
  });

  it("injects the brand-voice observer block when profile is non-stub", () => {
    const { systemPrompt } = buildScannerPromptV2(
      "Draft",
      { ...FULL_CONTEXT, brandVoice: USABLE_BRAND_VOICE },
      EMPTY_NEIGHBORS,
    );
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain(
      "User's established voice (flag drift only — do not rewrite toward this)",
    );
  });

  it("omits the brand-voice observer block when profile is the empty-corpus stub", () => {
    const { systemPrompt } = buildScannerPromptV2(
      "Draft",
      { ...FULL_CONTEXT, brandVoice: STUB_BRAND_VOICE },
      EMPTY_NEIGHBORS,
    );
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).not.toContain("User's established voice");
  });

  it("includes recent posts and topic tags in the variable suffix", () => {
    const { systemPrompt } = buildScannerPromptV2(
      "Draft",
      FULL_CONTEXT,
      EMPTY_NEIGHBORS,
    );
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("AI is changing everything in tech.");
    expect(joined).toContain("tech, productivity, AI");
  });
});

// ── parseAndValidateResponseV2 ───────────────────────────────────────

describe("parseAndValidateResponseV2", () => {
  it("parses a valid four-axis response", () => {
    const result = parseAndValidateResponseV2(VALID_V2_RESPONSE);
    expect(result.styleMatch.findings).toHaveLength(1);
    expect(result.styleMatch.findings[0].rule).toBe("sentence_structure");
    expect(result.algorithm.findings[0].rule).toBe("R1");
    expect(result.algorithm.findings[0].severity).toBe("warn");
    expect(result.psychology.summary).toContain("Hook is soft");
    expect(result.aiDetection.findings).toEqual([]);
  });

  it("preserves neighborCitations as _citations on the axis", () => {
    const result = parseAndValidateResponseV2(VALID_V2_RESPONSE);
    expect(result.styleMatch._citations).toEqual([1, 2]);
  });

  it("strips markdown code fences", () => {
    const fenced = "```json\n" + VALID_V2_RESPONSE + "\n```";
    const result = parseAndValidateResponseV2(fenced);
    expect(result.algorithm.findings[0].rule).toBe("R1");
  });

  it("strips code fences without language tag", () => {
    const fenced = "```\n" + VALID_V2_RESPONSE + "\n```";
    const result = parseAndValidateResponseV2(fenced);
    expect(result.algorithm.findings[0].rule).toBe("R1");
  });

  it("throws when an axis is missing", () => {
    const missingAxis = JSON.stringify({
      styleMatch: { summary: "", findings: [] },
      psychology: { summary: "", findings: [] },
      algorithm: { summary: "", findings: [] },
      // aiDetection missing
    });
    expect(() => parseAndValidateResponseV2(missingAxis)).toThrow(
      /missing axis: aiDetection/,
    );
  });

  it("throws on completely invalid JSON", () => {
    expect(() => parseAndValidateResponseV2("not json")).toThrow();
  });

  it("drops findings with invalid severity", () => {
    const raw = JSON.stringify({
      styleMatch: {
        summary: "",
        findings: [
          { severity: "warn", message: "Good finding" },
          { severity: "critical", message: "Bad severity" },
        ],
      },
      psychology: { summary: "", findings: [] },
      algorithm: { summary: "", findings: [] },
      aiDetection: { summary: "", findings: [] },
    });
    const result = parseAndValidateResponseV2(raw);
    expect(result.styleMatch.findings).toHaveLength(1);
    expect(result.styleMatch.findings[0].message).toBe("Good finding");
  });

  it("drops findings with empty message", () => {
    const raw = JSON.stringify({
      styleMatch: {
        summary: "",
        findings: [
          { severity: "warn", message: "" },
          { severity: "flag", message: "   " },
          { severity: "info", message: "Real one" },
        ],
      },
      psychology: { summary: "", findings: [] },
      algorithm: { summary: "", findings: [] },
      aiDetection: { summary: "", findings: [] },
    });
    const result = parseAndValidateResponseV2(raw);
    expect(result.styleMatch.findings).toHaveLength(1);
    expect(result.styleMatch.findings[0].message).toBe("Real one");
  });

  it("accepts algorithm findings with rule: \"R1\"", () => {
    const raw = JSON.stringify({
      styleMatch: { summary: "", findings: [] },
      psychology: { summary: "", findings: [] },
      algorithm: {
        summary: "",
        findings: [
          {
            rule: "R1",
            severity: "warn",
            message: "Engagement bait.",
            evidence: "like if you agree",
          },
        ],
      },
      aiDetection: { summary: "", findings: [] },
    });
    const result = parseAndValidateResponseV2(raw);
    expect(result.algorithm.findings[0].rule).toBe("R1");
    expect(result.algorithm.findings[0].evidence).toBe("like if you agree");
  });

  it("tolerates aiDetection placeholder with empty findings", () => {
    const raw = JSON.stringify({
      styleMatch: { summary: "", findings: [] },
      psychology: { summary: "", findings: [] },
      algorithm: { summary: "", findings: [] },
      aiDetection: { summary: "placeholder", findings: [] },
    });
    const result = parseAndValidateResponseV2(raw);
    expect(result.aiDetection.findings).toEqual([]);
    expect(result.aiDetection.summary).toBe("placeholder");
  });

  it("defaults summary to empty string when missing", () => {
    const raw = JSON.stringify({
      styleMatch: { findings: [] },
      psychology: { findings: [] },
      algorithm: { findings: [] },
      aiDetection: { findings: [] },
    });
    const result = parseAndValidateResponseV2(raw);
    expect(result.styleMatch.summary).toBe("");
  });

  it("drops invalid neighborCitations entries silently", () => {
    const raw = JSON.stringify({
      styleMatch: {
        summary: "",
        findings: [],
        neighborCitations: [1, "2", 0, -1, 3.5, 4],
      },
      psychology: { summary: "", findings: [] },
      algorithm: { summary: "", findings: [] },
      aiDetection: { summary: "", findings: [] },
    });
    const result = parseAndValidateResponseV2(raw);
    // Valid: 1, 4 (3.5 truncates to 3 — but 3.5 is not an integer so it's dropped;
    // 0 and -1 are out of range; "2" is not a number).
    expect(result.styleMatch._citations).toEqual([1, 4]);
  });
});
