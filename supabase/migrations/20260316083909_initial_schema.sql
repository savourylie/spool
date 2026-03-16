-- ============================================================
-- Spool: Initial Schema
-- ============================================================

-- 1. Tables
-- ------------------------------------------------------------

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threads_user_id text UNIQUE NOT NULL,
  username text,
  access_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  threads_media_id text UNIQUE NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL')),
  text_preview text,
  permalink text,
  topic_tag text,
  published_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  views int DEFAULT 0,
  likes int DEFAULT 0,
  replies int DEFAULT 0,
  reposts int DEFAULT 0,
  quotes int DEFAULT 0,
  shares int DEFAULT 0,
  fetched_at timestamptz DEFAULT now()
);

CREATE TABLE daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  followers_count int,
  views int,
  UNIQUE (user_id, date)
);

CREATE TABLE demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  key text NOT NULL,
  value numeric NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (user_id, dimension, key)
);

CREATE TABLE backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  total_posts int,
  processed_posts int DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 2. Indexes
-- ------------------------------------------------------------

CREATE INDEX idx_posts_user_published ON posts (user_id, published_at DESC);
CREATE INDEX idx_post_metrics_post_fetched ON post_metrics (post_id, fetched_at DESC);

-- 3. Row Level Security
-- ------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_jobs ENABLE ROW LEVEL SECURITY;

-- Allow anon role to SELECT backfill_jobs for Realtime subscriptions
CREATE POLICY "anon_read_backfill_jobs" ON backfill_jobs
  FOR SELECT TO anon USING (true);

-- 4. Realtime
-- ------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE backfill_jobs;
