-- One-time seed marker for post media/link metadata. Earlier installs stored
-- posts before media fields existed, so the first sync after this migration
-- walks the full thread list once and fills them in.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS post_content_seeded_at timestamptz;
