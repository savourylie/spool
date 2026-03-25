/**
 * Composer Prompt Construction
 *
 * Builds the LLM prompt for the AI Content Composer. Assembles user context
 * (top posts, demographics, topic clusters, cadence) into a structured prompt
 * that generates 2-3 draft variations targeting different share-trigger categories.
 *
 * Pure module — no database calls. DB fetching happens in the route handler.
 *
 * Depends on: llm-client (TICKET-037).
 */

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

// ── System Prompt Template ───────────────────────────────────────────

const COMPOSER_SYSTEM_PROMPT = `You are an expert social media content strategist specializing in the Threads algorithm. Your job is to draft high-performing posts for a creator based on their voice, audience, and performance history.

## Creator Profile

Followers: {FOLLOWER_COUNT}

## Top Performing Posts (ranked by Weighted Engagement Score)

These are the creator's best posts. Study their voice, tone, sentence structure, and style. Your drafts MUST sound like this creator wrote them — not like an AI.

{TOP_POSTS}

## Audience Demographics

{DEMOGRAPHICS}

## Content Pillars (Usual Topics)

{TOPIC_TAGS}

## Posting Cadence

{CADENCE}

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

Then write the post content. Keep each draft under 500 characters (Threads limit). Write in the creator's authentic voice based on their top posts above. Do NOT use hashtags unless the creator's top posts use them.

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

export function buildComposerPrompt(input: ComposerInput): {
  systemPrompt: string;
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

  const systemPrompt = COMPOSER_SYSTEM_PROMPT.replace(
    "{FOLLOWER_COUNT}",
    userContext.followerCount.toLocaleString(),
  )
    .replace("{TOP_POSTS}", topPostsBlock)
    .replace("{DEMOGRAPHICS}", demographicsBlock)
    .replace("{TOPIC_TAGS}", topicTagsBlock)
    .replace("{CADENCE}", cadenceBlock);

  let userMessage = `Topic: ${topic}`;
  if (style) {
    userMessage += `\nStyle: ${style}`;
  }

  return { systemPrompt, userMessage };
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
