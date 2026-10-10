-- Post prediction snapshots for TICKET-073.
-- Stores persisted prediction ranges plus the optional published text used
-- for later post link-back and review generation.

CREATE TABLE post_predictions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id               uuid REFERENCES posts(id) ON DELETE SET NULL,
  draft_text_hash       text NOT NULL,
  draft_text            text CHECK (draft_text IS NULL OR char_length(draft_text) <= 1000),
  predicted_at          timestamptz NOT NULL DEFAULT now(),
  ranges                jsonb NOT NULL,
  driver_factors        jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_windowed_metrics jsonb,
  review_state          text NOT NULL DEFAULT 'pending'
                        CHECK (review_state IN ('pending', 'reviewed', 'discarded')),
  reviewed_at           timestamptz
);

CREATE INDEX idx_post_predictions_user_hash
  ON post_predictions (user_id, draft_text_hash);

CREATE INDEX idx_post_predictions_unlinked_recent_published
  ON post_predictions (user_id, predicted_at DESC)
  WHERE post_id IS NULL
    AND draft_text IS NOT NULL
    AND review_state = 'pending';

ALTER TABLE post_predictions ENABLE ROW LEVEL SECURITY;
