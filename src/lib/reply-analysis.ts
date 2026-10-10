export const SHORT_REPLY_THRESHOLD = 5;
export const MEDIUM_REPLY_THRESHOLD = 20;

export interface ReplyRow {
  text: string | null;
  word_count: number | null;
}

export interface ClassifiedReplies {
  short: ReplyRow[];
  medium: ReplyRow[];
  long: ReplyRow[];
}

const WEIGHT_SHORT = 1;
const WEIGHT_MEDIUM = 5;
const WEIGHT_LONG = 10;
const MAX_WEIGHT = WEIGHT_LONG;

export function classifyReplies(replies: ReplyRow[]): ClassifiedReplies {
  const result: ClassifiedReplies = { short: [], medium: [], long: [] };

  for (const reply of replies) {
    const wc = reply.word_count ?? 0;
    if (wc >= MEDIUM_REPLY_THRESHOLD) {
      result.long.push(reply);
    } else if (wc >= SHORT_REPLY_THRESHOLD) {
      result.medium.push(reply);
    } else {
      result.short.push(reply);
    }
  }

  return result;
}

export function computeDiscussionQualityScore(replies: ReplyRow[]): number {
  if (replies.length === 0) return 0;

  const classified = classifyReplies(replies);
  const weightedSum =
    classified.short.length * WEIGHT_SHORT +
    classified.medium.length * WEIGHT_MEDIUM +
    classified.long.length * WEIGHT_LONG;

  return (weightedSum / (replies.length * MAX_WEIGHT)) * 100;
}
