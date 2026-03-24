-- Composite index for efficient recent post metric lookups.
-- Speeds up velocity-window queries that filter by post_id and order by fetched_at.
CREATE INDEX idx_post_metrics_recent
  ON post_metrics (post_id, fetched_at DESC);
