-- Drafts table for AI Content Composer (TICKET-042)
-- Stores LLM-generated post draft variations with quality metadata.

CREATE TABLE drafts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic                 text,
  content               text NOT NULL,
  share_trigger         text,
  quality_score         numeric,
  predicted_engagement  jsonb,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_drafts_user_created ON drafts (user_id, created_at DESC);

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
