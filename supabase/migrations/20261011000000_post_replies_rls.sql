-- post_replies was created without row level security, so the public anon key
-- (shipped to the browser for backfill_jobs Realtime) could read every user's
-- stored replies through the Data API. All app access goes through the service
-- role, which bypasses RLS, so enabling it with no policies only blocks anon
-- and authenticated clients, matching every other user-data table.

ALTER TABLE post_replies ENABLE ROW LEVEL SECURITY;
