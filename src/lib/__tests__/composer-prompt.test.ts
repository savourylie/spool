import { describe, expect, it } from "vitest";
import {
  buildComposerPrompt,
  parseComposerResponse,
  type ComposerUserContext,
} from "../composer-prompt";
import { flattenSystemBlocks } from "../llm-client";
import {
  BRAND_VOICE_DIMENSIONS,
  type BrandVoiceProfile,
  type BrandVoiceRecord,
} from "../brand-voice-types";

// ── Fixtures ──────────────────────────────────────────────────────────

const EMPTY_CONTEXT: ComposerUserContext = {
  topPosts: [],
  demographics: [],
  topicTags: [],
  cadence: { lastPostAt: null, avgGapHours: 24, recommendedWaitHours: 24 },
  followerCount: 0,
};

const FULL_CONTEXT: ComposerUserContext = {
  topPosts: [
    {
      text: "The best productivity hack is saying no to meetings that should be emails.",
      views: 12000,
      likes: 450,
      replies: 32,
      reposts: 15,
      quotes: 8,
      shares: 120,
      wes: 14.2,
    },
    {
      text: "Data point: teams that ship weekly grow 3x faster than quarterly shippers.",
      views: 8500,
      likes: 310,
      replies: 45,
      reposts: 22,
      quotes: 12,
      shares: 85,
      wes: 11.8,
    },
  ],
  demographics: [
    { dimension: "country", key: "US", value: 45 },
    { dimension: "country", key: "UK", value: 12 },
    { dimension: "gender", key: "male", value: 62 },
  ],
  topicTags: ["productivity", "startups", "engineering"],
  cadence: {
    lastPostAt: "2026-03-24T14:00:00Z",
    avgGapHours: 22.5,
    recommendedWaitHours: 22.5,
  },
  followerCount: 5200,
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

const DIRECTIONAL_BRAND_VOICE: BrandVoiceRecord = {
  profile: buildProfile(),
  sourcePostCount: 3,
  confidenceTier: "directional",
  updatedAt: "2026-04-23T00:00:00Z",
};

const USABLE_BRAND_VOICE: BrandVoiceRecord = {
  profile: buildProfile(),
  sourcePostCount: 12,
  confidenceTier: "usable",
  updatedAt: "2026-04-23T00:00:00Z",
};

const VALID_RESPONSE = `[TRIGGER: voice-of-the-reader]
Everyone talks about "deep work" but nobody admits the real problem: you can't do deep work when your calendar is controlled by other people.

---

[TRIGGER: time-saving-compilation]
5 rules I follow to protect my focus time:

1. No meetings before noon
2. Batch all 1:1s on Tuesday
3. "Let me check my calendar" = always no
4. 15-min cap on standups
5. Friday = no-meeting day

Steal this framework.

---

[TRIGGER: counterintuitive-data]
We tracked 200 engineering teams for a year.

Teams that had MORE meetings shipped FASTER — but only when meetings were under 15 minutes and had written agendas.

The enemy isn't meetings. It's unstructured meetings.`;

// ── buildComposerPrompt ──────────────────────────────────────────────

describe("buildComposerPrompt", () => {
  it("includes top posts in the system prompt", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("saying no to meetings");
    expect(joined).toContain("ship weekly grow 3x faster");
  });

  it("includes WES scores for top posts", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("WES: 14.2");
    expect(joined).toContain("WES: 11.8");
  });

  it("includes demographics in the system prompt", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("country: US (45%)");
    expect(joined).toContain("gender: male (62%)");
  });

  it("includes topic tags in the system prompt", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    expect(flattenSystemBlocks(systemPrompt)).toContain(
      "productivity, startups, engineering",
    );
  });

  it("includes cadence information", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("22.5 hours");
    expect(joined).toContain("2026-03-24T14:00:00Z");
  });

  it("includes follower count", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    expect(flattenSystemBlocks(systemPrompt)).toContain("5,200");
  });

  it("handles empty context gracefully", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "anything",
      userContext: EMPTY_CONTEXT,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("No posts available yet.");
    expect(joined).toContain("No demographic data available.");
    expect(joined).toContain("No established topics yet.");
    expect(joined).toContain("No posting history available.");
    expect(joined).not.toContain("undefined");
  });

  it("includes the topic in the user message", () => {
    const { userMessage } = buildComposerPrompt({
      topic: "remote work tips",
      userContext: EMPTY_CONTEXT,
    });
    expect(userMessage).toContain("Topic: remote work tips");
  });

  it("includes optional style in the user message", () => {
    const { userMessage } = buildComposerPrompt({
      topic: "remote work tips",
      style: "casual and humorous",
      userContext: EMPTY_CONTEXT,
    });
    expect(userMessage).toContain("Style: casual and humorous");
  });

  it("excludes style from user message when not provided", () => {
    const { userMessage } = buildComposerPrompt({
      topic: "remote work tips",
      userContext: EMPTY_CONTEXT,
    });
    expect(userMessage).not.toContain("Style:");
  });

  it("marks the knowledge prefix as cacheable and the creator profile as uncached", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    expect(systemPrompt.length).toBeGreaterThanOrEqual(2);
    expect(systemPrompt[0].cacheable).toBe(true);
    const variableBlock = systemPrompt.find((b) =>
      b.text.includes("saying no to meetings"),
    );
    expect(variableBlock).toBeDefined();
    expect(variableBlock?.cacheable).toBeFalsy();
  });

  // ── Brand Voice Gating (TICKET-070) ──────────────────────────────────

  it("does NOT inject brand voice when brandVoice is absent", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: FULL_CONTEXT,
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).not.toContain("User's brand voice");
  });

  it("does NOT inject brand voice when confidence tier is directional", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: { ...FULL_CONTEXT, brandVoice: DIRECTIONAL_BRAND_VOICE },
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).not.toContain("User's brand voice");
  });

  it("does NOT inject brand voice for the empty-corpus stub profile", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: { ...FULL_CONTEXT, brandVoice: STUB_BRAND_VOICE },
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).not.toContain("User's brand voice");
  });

  it("injects brand voice when tier is usable and corpus is non-empty", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: { ...FULL_CONTEXT, brandVoice: USABLE_BRAND_VOICE },
    });
    const joined = flattenSystemBlocks(systemPrompt);
    expect(joined).toContain("User's brand voice (compose to match)");
    expect(joined).toContain("Pattern for sentence_structure");
    expect(joined).toContain("Example excerpt A for humor");
  });

  it("injects the brand voice block as an uncached SystemBlock", () => {
    const { systemPrompt } = buildComposerPrompt({
      topic: "focus time",
      userContext: { ...FULL_CONTEXT, brandVoice: USABLE_BRAND_VOICE },
    });
    const brandVoiceBlock = systemPrompt.find((b) =>
      b.text.includes("User's brand voice (compose to match)"),
    );
    expect(brandVoiceBlock).toBeDefined();
    expect(brandVoiceBlock?.cacheable).toBeFalsy();
  });
});

// ── parseComposerResponse ────────────────────────────────────────────

describe("parseComposerResponse", () => {
  it("parses a valid 3-draft response with --- delimiters", () => {
    const drafts = parseComposerResponse(VALID_RESPONSE);
    expect(drafts).toHaveLength(3);
  });

  it("extracts trigger categories correctly", () => {
    const drafts = parseComposerResponse(VALID_RESPONSE);
    expect(drafts[0].shareTrigger).toBe("voice-of-the-reader");
    expect(drafts[1].shareTrigger).toBe("time-saving-compilation");
    expect(drafts[2].shareTrigger).toBe("counterintuitive-data");
  });

  it("extracts content without the trigger metadata line", () => {
    const drafts = parseComposerResponse(VALID_RESPONSE);
    expect(drafts[0].content).not.toContain("[TRIGGER:");
    expect(drafts[0].content).toContain("deep work");
  });

  it("handles markdown-fenced response", () => {
    const fenced = "```\n" + VALID_RESPONSE + "\n```";
    const drafts = parseComposerResponse(fenced);
    expect(drafts).toHaveLength(3);
    expect(drafts[0].shareTrigger).toBe("voice-of-the-reader");
  });

  it("returns empty array for empty input", () => {
    expect(parseComposerResponse("")).toEqual([]);
    expect(parseComposerResponse("   ")).toEqual([]);
  });

  it("defaults trigger for unrecognized values", () => {
    const response = `[TRIGGER: unknown-category]
Some draft content here.`;
    const drafts = parseComposerResponse(response);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].shareTrigger).toBe("voice-of-the-reader");
    expect(drafts[0].content).toContain("Some draft content here.");
  });

  it("handles response with no trigger lines", () => {
    const response = `First draft about productivity.

---

Second draft about engineering.`;
    const drafts = parseComposerResponse(response);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].shareTrigger).toBe("voice-of-the-reader");
    expect(drafts[1].shareTrigger).toBe("voice-of-the-reader");
  });

  it("handles response with fewer than 3 drafts", () => {
    const response = `[TRIGGER: conversation-framework]
Here's a useful template for giving feedback.`;
    const drafts = parseComposerResponse(response);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].shareTrigger).toBe("conversation-framework");
  });

  it("trims whitespace from draft content", () => {
    const response = `[TRIGGER: voice-of-the-reader]

  Some content with leading whitespace.
  `;
    const drafts = parseComposerResponse(response);
    expect(drafts[0].content).toBe("Some content with leading whitespace.");
  });
});
