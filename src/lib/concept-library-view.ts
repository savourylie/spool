import { classifyReuseRisk, REUSE_RISK_WINDOW_DAYS } from "@/lib/concept-library";
import { createAdminClient } from "@/lib/supabase/server";

export interface ConceptLedgerEntry {
  concept: string;
  analogy: string | null;
  post_id: string;
  seen_at: string;
}

export interface ConceptLedgerPost {
  id: string;
  text_preview: string | null;
  text_full: string | null;
  permalink: string | null;
  published_at: string;
  topic_tag: string | null;
}

export interface ConceptAnalogyCount {
  analogy: string;
  count: number;
}

export interface ConceptFirstSeenPost {
  id: string;
  textPreview: string | null;
  permalink: string | null;
  seenAt: string;
}

export interface ConceptLibraryRow {
  concept: string;
  firstSeenPost: ConceptFirstSeenPost | null;
  timesExplained: number;
  recentUseCount: number;
  analogies: ConceptAnalogyCount[];
  reuseRisk: "green" | "yellow" | "red";
  lastUsedAt: string;
  relatedCluster: string | null;
}

export interface ConceptPostOccurrence {
  postId: string;
  textPreview: string | null;
  permalink: string | null;
  seenAt: string;
  analogy: string | null;
  relatedCluster: string | null;
}

export interface ConceptAdvisoryMatch {
  concept: string;
  usesInWindow: number;
  totalUses: number;
  analogies: ConceptAnalogyCount[];
  reuseRisk: "green" | "yellow" | "red";
  lastUsedAt: string;
  relatedCluster: string | null;
}

export interface ConceptAdvisoryPayload {
  key: string;
  topic: string;
  windowDays: number;
  matches: ConceptAdvisoryMatch[];
}

const ADVISORY_LIMIT = 3;
const POST_FETCH_CHUNK_SIZE = 500;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "but",
  "can",
  "for",
  "from",
  "how",
  "into",
  "not",
  "that",
  "the",
  "this",
  "with",
  "you",
  "your",
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeConceptText(value: string): string[] {
  const tokens = normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return [...new Set(tokens)];
}

function countBy<T extends string>(items: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

function topCounts(counts: Map<string, number>): ConceptAnalogyCount[] {
  return [...counts.entries()]
    .map(([analogy, count]) => ({ analogy, count }))
    .sort((a, b) => b.count - a.count || a.analogy.localeCompare(b.analogy));
}

function chooseRelatedCluster(clusters: Array<string | null>): string | null {
  const counts = countBy(clusters.filter((c): c is string => !!c));
  return (
    [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? null
  );
}

function toPostPreview(post: ConceptLedgerPost | undefined): string | null {
  if (!post) return null;
  return post.text_preview ?? post.text_full?.slice(0, 280) ?? null;
}

export function buildConceptLibraryRows(
  entries: ConceptLedgerEntry[],
  posts: ConceptLedgerPost[],
  now: Date = new Date(),
): ConceptLibraryRow[] {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const sinceMs = now.getTime() - REUSE_RISK_WINDOW_DAYS * 86_400_000;
  const groups = new Map<string, ConceptLedgerEntry[]>();

  for (const entry of entries) {
    const concept = entry.concept.trim().toLowerCase();
    if (!concept) continue;
    const existing = groups.get(concept) ?? [];
    existing.push({ ...entry, concept });
    groups.set(concept, existing);
  }

  return [...groups.entries()]
    .map(([concept, group]) => {
      const sortedAsc = [...group].sort(
        (a, b) => new Date(a.seen_at).getTime() - new Date(b.seen_at).getTime(),
      );
      const sortedDesc = [...sortedAsc].reverse();
      const first = sortedAsc[0];
      const last = sortedDesc[0];
      const recentUseCount = group.filter(
        (entry) => new Date(entry.seen_at).getTime() >= sinceMs,
      ).length;
      const analogyCounts = topCounts(
        countBy(
          group
            .map((entry) => entry.analogy?.trim().toLowerCase())
            .filter((a): a is string => !!a),
        ),
      );
      const relatedCluster = chooseRelatedCluster(
        group.map((entry) => postsById.get(entry.post_id)?.topic_tag ?? null),
      );
      const firstPost = first ? postsById.get(first.post_id) : undefined;

      return {
        concept,
        firstSeenPost: first
          ? {
              id: first.post_id,
              textPreview: toPostPreview(firstPost),
              permalink: firstPost?.permalink ?? null,
              seenAt: first.seen_at,
            }
          : null,
        timesExplained: group.length,
        recentUseCount,
        analogies: analogyCounts,
        reuseRisk: classifyReuseRisk(recentUseCount),
        lastUsedAt: last?.seen_at ?? first?.seen_at ?? new Date(0).toISOString(),
        relatedCluster,
      } satisfies ConceptLibraryRow;
    })
    .sort(
      (a, b) =>
        new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime() ||
        a.concept.localeCompare(b.concept),
    );
}

function scoreConceptForTopic(
  row: ConceptLibraryRow,
  topic: string,
  allowClusterFallback: boolean,
): number {
  const normalizedTopic = normalizeText(topic);
  const conceptText = normalizeText(row.concept);
  const topicTokens = tokenizeConceptText(topic);
  const conceptTokens = tokenizeConceptText(row.concept);
  const overlap = conceptTokens.filter((token) => topicTokens.includes(token));

  if (
    normalizedTopic &&
    conceptText &&
    (normalizedTopic.includes(conceptText) || conceptText.includes(normalizedTopic))
  ) {
    return 100 + Math.min(row.recentUseCount, 10);
  }

  if (overlap.length > 0) {
    return 40 + overlap.length * 10 + Math.min(row.recentUseCount, 10);
  }

  if (allowClusterFallback && row.relatedCluster) {
    const clusterTokens = tokenizeConceptText(row.relatedCluster);
    const clusterOverlap = clusterTokens.filter((token) =>
      topicTokens.includes(token),
    );
    if (clusterOverlap.length > 0) {
      return 15 + clusterOverlap.length * 5;
    }
  }

  return 0;
}

function riskRank(risk: ConceptLibraryRow["reuseRisk"]): number {
  if (risk === "red") return 3;
  if (risk === "yellow") return 2;
  return 1;
}

export function buildConceptAdvisoryPayload(
  rows: ConceptLibraryRow[],
  topic: string,
  limit: number = ADVISORY_LIMIT,
): ConceptAdvisoryPayload | null {
  const normalizedTopic = normalizeText(topic);
  if (!normalizedTopic) return null;

  const directMatches = rows
    .map((row) => ({
      row,
      score: scoreConceptForTopic(row, topic, false),
    }))
    .filter((item) => item.score > 0 && item.row.recentUseCount > 0);

  const candidates =
    directMatches.length > 0
      ? directMatches
      : rows
          .map((row) => ({
            row,
            score: scoreConceptForTopic(row, topic, true),
          }))
          .filter((item) => item.score > 0 && item.row.recentUseCount > 0);

  const matches = candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        riskRank(b.row.reuseRisk) - riskRank(a.row.reuseRisk) ||
        b.row.recentUseCount - a.row.recentUseCount ||
        new Date(b.row.lastUsedAt).getTime() -
          new Date(a.row.lastUsedAt).getTime(),
    )
    .slice(0, limit)
    .map(({ row }) => ({
      concept: row.concept,
      usesInWindow: row.recentUseCount,
      totalUses: row.timesExplained,
      analogies: row.analogies.slice(0, 3),
      reuseRisk: row.reuseRisk,
      lastUsedAt: row.lastUsedAt,
      relatedCluster: row.relatedCluster,
    }));

  if (matches.length === 0) return null;

  return {
    key: `${normalizedTopic}:${matches.map((m) => m.concept).join("|")}`,
    topic,
    windowDays: REUSE_RISK_WINDOW_DAYS,
    matches,
  };
}

async function fetchPostsByIds(
  userId: string,
  postIds: string[],
): Promise<ConceptLedgerPost[]> {
  if (postIds.length === 0) return [];

  const supabase = createAdminClient();
  const posts: ConceptLedgerPost[] = [];

  for (let i = 0; i < postIds.length; i += POST_FETCH_CHUNK_SIZE) {
    const chunk = postIds.slice(i, i + POST_FETCH_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("posts")
      .select("id, text_preview, text_full, permalink, published_at, topic_tag")
      .eq("user_id", userId)
      .in("id", chunk);

    if (error) {
      throw new Error(`Failed to load concept posts: ${error.message}`);
    }

    posts.push(...(data ?? []));
  }

  return posts;
}

export async function fetchConceptLibraryRows(
  userId: string,
  now: Date = new Date(),
): Promise<ConceptLibraryRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("concept_ledger")
    .select("concept, analogy, post_id, seen_at")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load concept ledger: ${error.message}`);
  }

  const entries = data ?? [];
  const postIds = [...new Set(entries.map((entry) => entry.post_id))];
  const posts = await fetchPostsByIds(userId, postIds);

  return buildConceptLibraryRows(entries, posts, now);
}

export async function fetchConceptOccurrences(
  userId: string,
  concept: string,
): Promise<ConceptPostOccurrence[]> {
  const normalized = concept.trim().toLowerCase();
  if (!normalized) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("concept_ledger")
    .select("analogy, post_id, seen_at")
    .eq("user_id", userId)
    .eq("concept", normalized)
    .order("seen_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load concept occurrences: ${error.message}`);
  }

  const entries = (data ?? []).map((entry) => ({
    concept: normalized,
    analogy: entry.analogy,
    post_id: entry.post_id,
    seen_at: entry.seen_at,
  }));
  const posts = await fetchPostsByIds(
    userId,
    [...new Set(entries.map((entry) => entry.post_id))],
  );
  const postsById = new Map(posts.map((post) => [post.id, post]));

  return entries.map((entry) => {
    const post = postsById.get(entry.post_id);
    return {
      postId: entry.post_id,
      textPreview: toPostPreview(post),
      permalink: post?.permalink ?? null,
      seenAt: entry.seen_at,
      analogy: entry.analogy,
      relatedCluster: post?.topic_tag ?? null,
    };
  });
}

export async function fetchComposerConceptAdvisory(
  userId: string,
  topic: string,
): Promise<ConceptAdvisoryPayload | null> {
  const rows = await fetchConceptLibraryRows(userId);
  return buildConceptAdvisoryPayload(rows, topic);
}
