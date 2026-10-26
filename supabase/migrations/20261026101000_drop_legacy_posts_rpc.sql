-- The original five-argument get_posts_with_metrics overload survived earlier
-- CREATE OR REPLACE migrations (Postgres treats a changed argument list as a
-- new function). With the new optional arguments in place, five-argument calls
-- would resolve to that stale overload and silently lose the media fields.
DROP FUNCTION IF EXISTS get_posts_with_metrics(uuid, text, text, int, int);
