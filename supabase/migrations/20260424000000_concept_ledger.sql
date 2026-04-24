-- Concept ledger (TICKET-080).
-- One row per (user, concept, post) extracted by the classifier. Used by
-- the Concept Library UI (#081) to flag reuse risk on a new draft.

CREATE TABLE concept_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept    text NOT NULL,
  analogy    text,
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  seen_at    timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: rerunning extraction on the same post cannot insert duplicate rows.
CREATE UNIQUE INDEX idx_concept_ledger_unique_user_concept_post
  ON concept_ledger (user_id, concept, post_id);

-- Fast path for computeReuseRisk: fetch concept rows inside a rolling window.
CREATE INDEX idx_concept_ledger_user_concept_seen
  ON concept_ledger (user_id, concept, seen_at DESC);

ALTER TABLE concept_ledger ENABLE ROW LEVEL SECURITY;

-- Marker on posts: NULL = concept extractor has never run for this post.
ALTER TABLE posts ADD COLUMN concept_extracted_at timestamptz;
