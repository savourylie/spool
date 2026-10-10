create or replace function get_timing_heatmap_data(p_user_id uuid)
returns table (
  published_at timestamptz,
  views bigint,
  likes bigint,
  replies bigint,
  reposts bigint,
  quotes bigint,
  shares bigint
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
      pm.shares
    from post_metrics pm
    inner join posts p on p.id = pm.post_id
    where p.user_id = p_user_id
    order by pm.post_id, pm.fetched_at desc
  )
  select
    p.published_at,
    coalesce(m.views, 0)    as views,
    coalesce(m.likes, 0)    as likes,
    coalesce(m.replies, 0)  as replies,
    coalesce(m.reposts, 0)  as reposts,
    coalesce(m.quotes, 0)   as quotes,
    coalesce(m.shares, 0)   as shares
  from posts p
  left join latest_metrics m on m.post_id = p.id
  where p.user_id = p_user_id;
$$;
