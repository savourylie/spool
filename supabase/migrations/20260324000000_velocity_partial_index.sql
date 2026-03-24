-- Partial index for efficient recent post metric lookups.
-- Covers only rows fetched within the last 3 days, keeping the index small
-- and making velocity-window queries fast without affecting older data.
CREATE INDEX idx_post_metrics_recent
  ON post_metrics (post_id, fetched_at DESC)
  WHERE fetched_at > now() - interval '3 days';
