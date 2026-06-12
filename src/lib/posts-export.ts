/**
 * CSV export of posts with their latest metrics snapshot.
 * Shape matches the export_posts_with_latest_metrics RPC; metric
 * columns are null for posts that have no snapshot yet.
 */
export interface ExportPostRow {
  threads_media_id: string;
  media_type: string;
  text_full: string | null;
  text_preview: string | null;
  permalink: string | null;
  topic_tag: string | null;
  published_at: string;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  shares: number | null;
  fetched_at: string | null;
}

const CSV_HEADER = [
  "published_at",
  "media_type",
  "text",
  "permalink",
  "topic_tag",
  "views",
  "likes",
  "replies",
  "reposts",
  "quotes",
  "shares",
  "engagement_rate",
  "metrics_fetched_at",
  "threads_media_id",
] as const;

/** RFC 4180: quote fields containing commas, quotes, or line breaks. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Engagement rate as a percentage string with 2 decimals, matching the
 * dashboard's get_posts_with_metrics formula. Empty string when there
 * is no snapshot or no views — distinguishable from a true 0.
 */
export function computeEngagementRate(row: ExportPostRow): string {
  if (row.views === null || row.views === 0) {
    return "";
  }
  const interactions =
    (row.likes ?? 0) +
    (row.replies ?? 0) +
    (row.reposts ?? 0) +
    (row.quotes ?? 0) +
    (row.shares ?? 0);
  return ((interactions / row.views) * 100).toFixed(2);
}

export function buildPostsExportCsv(rows: ExportPostRow[]): string {
  const metric = (value: number | null) =>
    value === null ? "" : String(value);

  const lines = [CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.published_at),
        escapeCsvField(row.media_type),
        escapeCsvField(row.text_full ?? row.text_preview ?? ""),
        escapeCsvField(row.permalink ?? ""),
        escapeCsvField(row.topic_tag ?? ""),
        metric(row.views),
        metric(row.likes),
        metric(row.replies),
        metric(row.reposts),
        metric(row.quotes),
        metric(row.shares),
        computeEngagementRate(row),
        escapeCsvField(row.fetched_at ?? ""),
        escapeCsvField(row.threads_media_id),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
