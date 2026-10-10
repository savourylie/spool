import type { ILLMClient } from "@/lib/llm-provider";

export const REPLY_RISK_LEVELS = ["unknown", "low", "medium", "high"] as const;
export type ReplyRiskLevel = (typeof REPLY_RISK_LEVELS)[number];

export const REPLY_RISK_CATEGORIES = [
  "offensive",
  "harassment",
  "sexual",
  "violent",
  "political",
  "privacy",
  "professionalism",
  "other",
] as const;
export type ReplyRiskCategory = (typeof REPLY_RISK_CATEGORIES)[number];

export interface ReplyRiskInput {
  threadsReplyId: string;
  text: string;
}

export interface ReplyRiskResult {
  threadsReplyId: string;
  riskLevel: ReplyRiskLevel;
  riskCategories: ReplyRiskCategory[];
  riskSummary: string;
}

const VALID_RISK_LEVELS = new Set<string>(REPLY_RISK_LEVELS);
const VALID_RISK_CATEGORIES = new Set<string>(REPLY_RISK_CATEGORIES);

const REPLY_RISK_SYSTEM_PROMPT = `You are a reputation-risk reviewer for a creator's public Threads replies. Analyze only whether each reply could negatively affect the creator's public image.

Return ONLY valid JSON with this exact shape:
{
  "results": [
    {
      "threadsReplyId": "string",
      "riskLevel": "low | medium | high",
      "categories": ["offensive | harassment | sexual | violent | political | privacy | professionalism | other"],
      "summary": "short plain-English reason, or 'Looks fine.'"
    }
  ]
}

Use high only for clearly reputation-damaging content. Use medium for replies that could plausibly read as unprofessional, combative, insensitive, or privacy-risky out of context. Use low for normal public replies. Do not invent context beyond the reply text.`;

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseRiskLevel(value: unknown): ReplyRiskLevel {
  if (typeof value === "string" && VALID_RISK_LEVELS.has(value)) {
    return value as ReplyRiskLevel;
  }
  return "unknown";
}

function parseCategories(value: unknown): ReplyRiskCategory[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (category): category is ReplyRiskCategory =>
      typeof category === "string" && VALID_RISK_CATEGORIES.has(category),
  );
}

export function parseReplyRiskResponse(
  raw: string,
  allowedReplyIds: Set<string>,
): ReplyRiskResult[] {
  const parsed = JSON.parse(stripFences(raw)) as { results?: unknown };
  if (!Array.isArray(parsed.results)) return [];

  const results: ReplyRiskResult[] = [];
  for (const item of parsed.results) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const threadsReplyId = record.threadsReplyId;
    if (typeof threadsReplyId !== "string" || !allowedReplyIds.has(threadsReplyId)) {
      continue;
    }

    results.push({
      threadsReplyId,
      riskLevel: parseRiskLevel(record.riskLevel),
      riskCategories: parseCategories(record.categories),
      riskSummary:
        typeof record.summary === "string" && record.summary.trim().length > 0
          ? record.summary.trim()
          : "No summary returned.",
    });
  }

  return results;
}

export async function analyzeReplyRisks(
  replies: ReplyRiskInput[],
  llm: Pick<ILLMClient, "generate">,
): Promise<ReplyRiskResult[]> {
  if (replies.length === 0) return [];

  const allowedReplyIds = new Set(replies.map((reply) => reply.threadsReplyId));
  const userMessage = [
    "Analyze these Threads replies for public-image risk. Return one result for each reply id.",
    "",
    JSON.stringify(
      {
        replies: replies.map((reply) => ({
          threadsReplyId: reply.threadsReplyId,
          text: reply.text,
        })),
      },
      null,
      2,
    ),
  ].join("\n");

  const raw = await llm.generate({
    systemPrompt: REPLY_RISK_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 2048,
    timeout: 30_000,
  });

  return parseReplyRiskResponse(raw, allowedReplyIds);
}
