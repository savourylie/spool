-- All of a user's posts joined with the latest post_metrics snapshot,
-- for the CSV export endpoint. LEFT JOIN keeps posts that have no
-- snapshot yet (metric columns come back null, not 0 — the export
-- distinguishes "no data" from a true zero).
create or replace function export_posts_with_latest_metrics(p_user_id uuid)
returns table (
  threads_media_id text,
  media_type text,
  text_full text,
  text_preview text,
  permalink text,
  topic_tag text,
  published_at timestamptz,
  views int,
  likes int,
  replies int,
  reposts int,
  quotes int,
  shares int,
  fetched_at timestamptz
)
language sql stable
as $$
  with latest_metrics as (
    select distinct on (pm.post_id)
      pm.post_id,
      pm.views,
      pm.likes,
      pm.replies,
      pm.reposts,
      pm.quotes,
      pm.shares,
      pm.fetched_at
    from post_metrics pm
    inner join posts p on p.id = pm.post_id
    where p.user_id = p_user_id
    order by pm.post_id, pm.fetched_at desc
  )
  select
    p.threads_media_id,
    p.media_type,
    p.text_full,
    p.text_preview,
    p.permalink,
    p.topic_tag,
    p.published_at,
    m.views,
    m.likes,
    m.replies,
    m.reposts,
    m.quotes,
    m.shares,
    m.fetched_at
  from posts p
  left join latest_metrics m on m.post_id = p.id
  where p.user_id = p_user_id
  order by p.published_at desc;
$$;
