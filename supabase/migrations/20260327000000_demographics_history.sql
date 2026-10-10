-- Append-only demographics history for audience fit analysis (TICKET-035).
-- Unlike the `demographics` table (which upserts the latest snapshot),
-- this table archives every daily snapshot so we can detect shifts over time.

CREATE TABLE demographics_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension  text NOT NULL,
  key        text NOT NULL,
  value      numeric NOT NULL,
  fetched_at timestamptz DEFAULT now()
);

CREATE INDEX idx_demographics_history_user_fetched
  ON demographics_history (user_id, fetched_at);

ALTER TABLE demographics_history ENABLE ROW LEVEL SECURITY;
