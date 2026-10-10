// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "am",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us",
  "them", "my", "your", "his", "its", "our", "their", "this", "that", "these",
  "those", "and", "but", "or", "not", "no", "so", "if", "do", "did", "does",
  "has", "have", "had", "will", "would", "can", "could", "shall", "should",
  "may", "might", "must", "of", "in", "on", "at", "to", "for", "with", "from",
  "by", "about", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "out", "off", "up", "down", "then", "than", "too", "very",
  "just", "also", "now", "here", "there", "when", "where", "how", "what", "which",
  "who", "whom", "why", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "only", "own", "same", "over", "again", "once",
  "like", "get", "got", "dont", "ive", "ill", "its", "im", "really", "still",
  "even", "back", "going", "much", "well", "way", "thing", "things", "need",
  "want", "know", "think", "make", "made", "take", "come", "came", "see", "say",
  "said", "one", "two", "new",
]);

export const DEFAULT_TOP_N = 5;
export const MIN_TOKEN_LENGTH = 3;
export const MIN_CONFIDENCE = 0.1;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TopicCluster {
  topic: string;
  keywords: string[];
  score: number;
}

export interface TopicClassification {
  topic: string;
  confidence: number;
}

export interface TopicPost {
  text: string | null;
}

export interface FocusPost {
  topic_tag: string | null;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(t));
}

// ---------------------------------------------------------------------------
// TF-IDF Topic Extraction
// ---------------------------------------------------------------------------

export function extractTopics(
  posts: TopicPost[],
  topN: number = DEFAULT_TOP_N,
): TopicCluster[] {
  const docs = posts
    .map((p) => p.text)
    .filter((t): t is string => t != null && t.trim().length > 0)
    .map((t) => tokenize(t));

  if (docs.length === 0) return [];

  // Term frequency per document
  const docTFs: Map<string, number>[] = [];
  // Document frequency: how many docs contain each term
  const df = new Map<string, number>();
  // Track which docs contain each term (for clustering)
  const termDocs = new Map<string, Set<number>>();

  for (let i = 0; i < docs.length; i++) {
    const tokens = docs[i];
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    // Normalize TF by doc length
    if (tokens.length > 0) {
      for (const [term, count] of tf) {
        tf.set(term, count / tokens.length);
      }
    }
    docTFs.push(tf);

    // Update DF and termDocs
    for (const term of new Set(tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1);
      if (!termDocs.has(term)) termDocs.set(term, new Set());
      termDocs.get(term)!.add(i);
    }
  }

  // Score terms using TF-IDF weighted by document frequency.
  // Standard TF-IDF boosts rare terms, but for topic identification we want
  // terms that appear consistently across many posts. Multiplying by (df/N)
  // favors terms the user writes about repeatedly.
  const termScore = new Map<string, number>();
  const N = docs.length;

  for (const [term, docFreq] of df) {
    const idf = Math.log(N / docFreq);
    let totalTfIdf = 0;
    for (const docTf of docTFs) {
      const tf = docTf.get(term) ?? 0;
      totalTfIdf += tf * idf;
    }
    termScore.set(term, totalTfIdf * (docFreq / N));
  }

  // Sort terms by score descending
  const rankedTerms = [...termScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN * 3);

  // Cluster by co-occurrence using Jaccard similarity
  const clusters: TopicCluster[] = [];

  for (const [term, score] of rankedTerms) {
    const docsA = termDocs.get(term)!;
    let merged = false;

    for (const cluster of clusters) {
      const seedDocs = termDocs.get(cluster.topic)!;
      const intersection = [...docsA].filter((d) => seedDocs.has(d)).length;
      const union = new Set([...docsA, ...seedDocs]).size;
      const jaccard = union > 0 ? intersection / union : 0;

      if (jaccard >= 0.3) {
        cluster.keywords.push(term);
        cluster.score += score;
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({ topic: term, keywords: [term], score });
    }
  }

  return clusters
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ---------------------------------------------------------------------------
// Post Topic Classification
// ---------------------------------------------------------------------------

export function classifyPostTopic(
  postText: string | null,
  clusters: TopicCluster[],
): TopicClassification | null {
  if (!postText || postText.trim().length === 0 || clusters.length === 0) {
    return null;
  }

  const tokens = new Set(tokenize(postText));
  let bestTopic: string | null = null;
  let bestConfidence = 0;

  for (const cluster of clusters) {
    const matches = cluster.keywords.filter((kw) => tokens.has(kw)).length;
    const confidence = cluster.keywords.length > 0
      ? matches / cluster.keywords.length
      : 0;

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestTopic = cluster.topic;
    }
  }

  if (bestTopic === null || bestConfidence < MIN_CONFIDENCE) return null;

  return { topic: bestTopic, confidence: bestConfidence };
}

// ---------------------------------------------------------------------------
// Focus Score
// ---------------------------------------------------------------------------

const TOP_TAG_COUNT = 3;

export function computeFocusScore(posts: FocusPost[]): number {
  if (posts.length === 0) return 0;

  // Count frequency of each topic_tag
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.topic_tag != null) {
      counts.set(post.topic_tag, (counts.get(post.topic_tag) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return 0;

  // Find top N most frequent tags
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const topTags = new Set(sorted.slice(0, TOP_TAG_COUNT).map(([tag]) => tag));

  // Score = posts matching top tags / total posts
  const matchingPosts = posts.filter(
    (p) => p.topic_tag != null && topTags.has(p.topic_tag),
  ).length;

  return (matchingPosts / posts.length) * 100;
}
