-- Brand voice profiles for TICKET-068.
-- One row per user. Upsert-only (no deletion endpoint).
-- profile jsonb is the validated 11-dimension extraction output.

CREATE TABLE brand_voice_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile            jsonb NOT NULL,
  source_post_count  int   NOT NULL DEFAULT 0,
  confidence_tier    text  NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brand_voice_profiles ENABLE ROW LEVEL SECURITY;
