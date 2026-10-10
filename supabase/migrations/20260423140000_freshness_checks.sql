-- Freshness gate audit log (TICKET-071).
-- One row per call to checkTopicFreshness. run_id groups multiple checks
-- from a single UI interaction (e.g. user types 3 topics at once).
-- Retention policy is future work.

CREATE TABLE freshness_checks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                uuid NOT NULL,
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic                 text NOT NULL,
  verdict               text NOT NULL CHECK (verdict IN ('green','yellow','red')),
  external_signal       jsonb,
  self_repetition_risk  jsonb,
  sources               jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_freshness_checks_user_created ON freshness_checks (user_id, created_at DESC);
CREATE INDEX idx_freshness_checks_run_id ON freshness_checks (run_id);

ALTER TABLE freshness_checks ENABLE ROW LEVEL SECURITY;
