/**
 * Composer Prompt Construction
 *
 * Builds the LLM prompt for the AI Content Composer. Assembles user context
 * (top posts, demographics, topic clusters, cadence) into a structured prompt
 * that generates 2-3 draft variations targeting different share-trigger categories.
 *
 * Pure module — no database calls. DB fetching happens in the route handler.
 *
 * Brand voice discipline (TICKET-070): Composer is the DRIVER — drafts
 * must match the creator's profile patterns. Gated by confidence tier.
 * See `src/lib/prompts/brand-voice-usage.md` for the full driver-vs-observer
 * contract and why Scanner must NOT mirror this pattern.
 *
 * Depends on: llm-client (TICKET-037), prompt loader (TICKET-067),
 * brand voice extraction (TICKET-068).
 */

import type { SystemBlock } from "@/lib/llm-client";
import { loadPrompt } from "@/lib/prompts/loader";
import {
  BRAND_VOICE_DIMENSIONS,
  type BrandVoiceRecord,
} from "@/lib/brand-voice-types";

// ── Types ────────────────────────────────────────────────────────────

export interface ComposerTopPost {
  text: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  wes: number;
}

export interface ComposerUserContext {
  topPosts: ComposerTopPost[];
  demographics: { dimension: string; key: string; value: number }[];
  topicTags: string[];
  cadence: {
    lastPostAt: string | null;
    avgGapHours: number;
    recommendedWaitHours: number;
  };
  followerCount: number;
  /** Brand voice profile (TICKET-070). Injected as driver when confidence
   *  tier is usable-or-higher and source corpus is non-empty. See
   *  `src/lib/prompts/brand-voice-usage.md`. */
  brandVoice?: BrandVoiceRecord | null;
}

export interface ComposerInput {
  topic: string;
  style?: string;
  userContext: ComposerUserContext;
}

export type ShareTriggerCategory =
  | "voice-of-the-reader"
  | "time-saving-compilation"
  | "counterintuitive-data"
  | "conversation-framework";

const VALID_TRIGGERS: readonly string[] = [
  "voice-of-the-reader",
  "time-saving-compilation",
  "counterintuitive-data",
  "conversation-framework",
];

export interface GeneratedDraft {
  content: string;
  shareTrigger: ShareTriggerCategory;
}

// ── Static Composer Instructions ─────────────────────────────────────

const COMPOSER_INSTRUCTIONS = `You are an expert social media content strategist specializing in the Threads algorithm. Your job is to draft high-performing posts for a creator based on their voice, audience, and performance history.

Use the algorithm and psychology references above when judging which hook, structure, and share-trigger will perform best. Never violate the red lines (R1–R12).

## Share-Trigger Categories

The Threads algorithm heavily weights private shares (DMs). These are the 4 content types that trigger shares:

1. **voice-of-the-reader** — Articulating what readers think but can't express. Posts that make people say "this is exactly what I was thinking."
2. **time-saving-compilation** — Systematic time-saving compilations: checklists, curated lists, how-tos, step-by-step guides.
3. **counterintuitive-data** — Counterintuitive data-backed conclusions. Surprising facts or insights that challenge common assumptions.
4. **conversation-framework** — Shareable conversation frameworks: templates, prompts, mental models, or structures others can reuse.

## Output Format

Generate exactly 3 draft variations. Each MUST target a DIFFERENT share-trigger category (pick the 3 most relevant for the topic).

Separate each draft with a line containing only \`---\`.

Start each draft with a metadata line in this exact format:
\`[TRIGGER: <category>]\`

Where \`<category>\` is one of: voice-of-the-reader, time-saving-compilation, counterintuitive-data, conversation-framework

Then write the post content. Keep each draft under 500 characters (Threads limit). Write in the creator's authentic voice based on their top posts. Do NOT use hashtags unless the creator's top posts use them.

Example format:
\`\`\`
[TRIGGER: voice-of-the-reader]
Post content here...

---

[TRIGGER: time-saving-compilation]
Post content here...

---

[TRIGGER: counterintuitive-data]
Post content here...
\`\`\``;

// ── Prompt Builder ───────────────────────────────────────────────────

/**
 * Build the composer system prompt as an array of SystemBlocks. The stable
 * knowledge prefix (algorithm + psychology + static instructions) is marked
 * `cacheable: true` so Anthropic prompt caching can reuse it. The creator
 * profile — top posts, demographics, topic tags, cadence — is per-user and
 * kept uncached.
 */
export function buildComposerPrompt(input: ComposerInput): {
  systemPrompt: SystemBlock[];
  userMessage: string;
} {
  const { topic, style, userContext } = input;

  // Top posts block
  const topPostsBlock =
    userContext.topPosts.length > 0
      ? userContext.topPosts
          .map(
            (p, i) =>
              `${i + 1}. [WES: ${p.wes.toFixed(1)} | Views: ${p.views} | Likes: ${p.likes} | Replies: ${p.replies} | Shares: ${p.shares}]\n${p.text}`,
          )
          .join("\n\n")
      : "No posts available yet.";

  // Demographics block
  const demographicsBlock =
    userContext.demographics.length > 0
      ? userContext.demographics
          .map((d) => `- ${d.dimension}: ${d.key} (${d.value}%)`)
          .join("\n")
      : "No demographic data available.";

  // Topic tags block
  const topicTagsBlock =
    userContext.topicTags.length > 0
      ? userContext.topicTags.join(", ")
      : "No established topics yet.";

  // Cadence block
  const cadenceBlock = userContext.cadence.lastPostAt
    ? `Last post: ${userContext.cadence.lastPostAt}\nAverage gap: ${userContext.cadence.avgGapHours.toFixed(1)} hours\nRecommended wait: ${userContext.cadence.recommendedWaitHours.toFixed(1)} hours`
    : "No posting history available.";

  // Stable prefix: algorithm + psychology knowledge + composer instructions.
  const knowledgePrefix = [
    loadPrompt("algorithm"),
    loadPrompt("psychology"),
    COMPOSER_INSTRUCTIONS,
  ].join("\n\n");

  // User-variable suffix: creator profile.
  const creatorProfile = [
    "## Creator Profile",
    "",
    `Followers: ${userContext.followerCount.toLocaleString()}`,
    "",
    "## Top Performing Posts (ranked by Weighted Engagement Score)",
    "",
    "These are the creator's best posts. Study their voice, tone, sentence structure, and style. Your drafts MUST sound like this creator wrote them — not like an AI.",
    "",
    topPostsBlock,
    "",
    "## Audience Demographics",
    "",
    demographicsBlock,
    "",
    "## Content Pillars (Usual Topics)",
    "",
    topicTagsBlock,
    "",
    "## Posting Cadence",
    "",
    cadenceBlock,
  ].join("\n");

  let userMessage = `Topic: ${topic}`;
  if (style) {
    userMessage += `\nStyle: ${style}`;
  }

  // Brand voice block (TICKET-070): injected as driver when the profile is
  // trustworthy. Below "usable" tier or with an empty-corpus stub, fall back
  // to the top-10-posts anchor alone.
  const brandVoice = userContext.brandVoice;
  const useBrandVoice =
    !!brandVoice &&
    brandVoice.sourcePostCount > 0 &&
    brandVoice.confidenceTier !== "directional";

  const blocks: SystemBlock[] = [
    { text: knowledgePrefix, cacheable: true },
    { text: creatorProfile },
  ];

  if (useBrandVoice && brandVoice) {
    blocks.push({ text: buildBrandVoiceDriverBlock(brandVoice) });
  }

  return {
    systemPrompt: blocks,
    userMessage,
  };
}

// ── Brand Voice Driver Block (TICKET-070) ────────────────────────────

/**
 * Build the Composer's brand-voice injection block. Each of the 11
 * dimensions is rendered as pattern + up to 2 evidence excerpts. The
 * block title tells the LLM to treat these as composition constraints
 * ("compose to match"), matching the DRIVER discipline documented in
 * `src/lib/prompts/brand-voice-usage.md`.
 */
function buildBrandVoiceDriverBlock(record: BrandVoiceRecord): string {
  const dimensionLines: string[] = [];

  for (const dim of BRAND_VOICE_DIMENSIONS) {
    const entry = record.profile[dim];
    if (!entry) continue;
    const excerpts = entry.evidence.slice(0, 2);
    const excerptLines = excerpts.map((e) => `  - "${e.excerpt}"`).join("\n");

    dimensionLines.push(
      `### ${dim}\nPattern: ${entry.pattern}${
        excerptLines ? `\nExamples:\n${excerptLines}` : ""
      }`,
    );
  }

  return [
    "## User's brand voice (compose to match)",
    "",
    `These 11 dimensions describe the creator's established voice (extracted from ${record.sourcePostCount} posts, confidence: ${record.confidenceTier}). Match these patterns in every draft — sentence structure, rhythm, humor, analogies, taboo phrases. The evidence examples are diagnostic — do NOT copy them verbatim.`,
    "",
    dimensionLines.join("\n\n"),
  ].join("\n");
}

// ── Response Parser ──────────────────────────────────────────────────

function isValidTrigger(value: string): value is ShareTriggerCategory {
  return VALID_TRIGGERS.includes(value);
}

const TRIGGER_REGEX = /^\[TRIGGER:\s*([^\]]+)\]\s*$/m;

export function parseComposerResponse(raw: string): GeneratedDraft[] {
  if (!raw.trim()) return [];

  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[^\n]*\n?/, "").replace(/\n?```\s*$/, "");
  }

  // Split on --- delimiter lines (also handle leading --- after fence strip)
  const sections = cleaned
    .split(/\n---\n|^---\n/m)
    .map((s) => s.trim())
    .filter(Boolean);

  const drafts: GeneratedDraft[] = [];

  for (const section of sections) {
    const triggerMatch = section.match(TRIGGER_REGEX);
    let shareTrigger: ShareTriggerCategory = "voice-of-the-reader";
    let content = section;

    if (triggerMatch) {
      const candidate = triggerMatch[1].trim();
      if (isValidTrigger(candidate)) {
        shareTrigger = candidate;
      }
      // Remove the trigger line from content
      content = section.replace(TRIGGER_REGEX, "").trim();
    }

    if (content) {
      drafts.push({ content, shareTrigger });
    }
  }

  return drafts;
}
