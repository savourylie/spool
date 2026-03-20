create or replace function get_posts_with_metrics(
  p_user_id uuid,
  p_sort_column text,
  p_sort_order text,
  p_limit int,
  p_offset int,
  p_media_types text[] default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns table (
  id text,
  media_type text,
  text_preview text,
  permalink text,
  published_at timestamptz,
  views bigint,
  likes bigint,
  replies bigint,
  reposts bigint,
  quotes bigint,
  shares bigint,
  engagement_rate numeric,
  total_count bigint
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
      and (p_media_types is null or p.media_type = any(p_media_types))
      and (p_date_from is null or p.published_at >= p_date_from)
      and (p_date_to is null or p.published_at < p_date_to + interval '1 day')
    order by pm.post_id, pm.fetched_at desc
  ),
  joined as (
    select
      p.id,
      p.media_type,
      p.text_preview,
      p.permalink,
      p.published_at,
      coalesce(m.views, 0)    as views,
      coalesce(m.likes, 0)    as likes,
      coalesce(m.replies, 0)  as replies,
      coalesce(m.reposts, 0)  as reposts,
      coalesce(m.quotes, 0)   as quotes,
      coalesce(m.shares, 0)   as shares,
      case when coalesce(m.views, 0) > 0
        then (coalesce(m.likes,0) + coalesce(m.replies,0) + coalesce(m.reposts,0)
              + coalesce(m.quotes,0) + coalesce(m.shares,0))::numeric
              / m.views * 100
        else 0
      end as engagement_rate,
      count(*) over () as total_count
    from posts p
    left join latest_metrics m on m.post_id = p.id
    where p.user_id = p_user_id
      and (p_media_types is null or p.media_type = any(p_media_types))
      and (p_date_from is null or p.published_at >= p_date_from)
      and (p_date_to is null or p.published_at < p_date_to + interval '1 day')
  )
  select *
  from joined
  order by
    case when p_sort_order = 'asc' then
      case p_sort_column
        when 'published_at'   then extract(epoch from joined.published_at)
        when 'views'           then joined.views
        when 'likes'           then joined.likes
        when 'replies'         then joined.replies
        when 'reposts'         then joined.reposts
        when 'quotes'          then joined.quotes
        when 'shares'          then joined.shares
        when 'engagement_rate' then joined.engagement_rate
      end
    end asc nulls last,
    case when p_sort_order <> 'asc' then
      case p_sort_column
        when 'published_at'   then extract(epoch from joined.published_at)
        when 'views'           then joined.views
        when 'likes'           then joined.likes
        when 'replies'         then joined.replies
        when 'reposts'         then joined.reposts
        when 'quotes'          then joined.quotes
        when 'shares'          then joined.shares
        when 'engagement_rate' then joined.engagement_rate
      end
    end desc nulls last
  limit p_limit
  offset p_offset;
$$;
