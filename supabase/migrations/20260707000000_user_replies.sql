-- Authored replies audit: replies the connected user wrote anywhere on Threads,
-- with advisory AI reputation-risk labels and the user's review status.

CREATE TABLE user_replies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  threads_reply_id    text UNIQUE NOT NULL,
  text                text,
  permalink           text,
  replied_at          timestamptz NOT NULL,
  root_post_id        text,
  replied_to_id       text,
  media_type          text,
  shortcode           text,
  risk_level          text NOT NULL DEFAULT 'unknown'
    CHECK (risk_level IN ('unknown', 'low', 'medium', 'high')),
  risk_categories     text[] NOT NULL DEFAULT '{}',
  risk_summary        text,
  risk_analyzed_at    timestamptz,
  review_status       text NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review', 'reviewed')),
  fetched_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_replies_user_replied_at
  ON user_replies (user_id, replied_at DESC);

CREATE INDEX idx_user_replies_user_risk
  ON user_replies (user_id, risk_level);

CREATE INDEX idx_user_replies_user_review
  ON user_replies (user_id, review_status);

ALTER TABLE user_replies ENABLE ROW LEVEL SECURITY;
