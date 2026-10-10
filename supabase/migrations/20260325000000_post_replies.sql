CREATE TABLE post_replies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  threads_reply_id text UNIQUE NOT NULL,
  text             text,
  word_count       int,
  replied_at       timestamptz,
  fetched_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_post_replies_post ON post_replies (post_id);
