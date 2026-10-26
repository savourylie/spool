-- Post library tabs: rich post media, link previews, and repost history.
--
-- Threads' `GET /{user-id}/threads` endpoint exposes media_url, thumbnail_url,
-- alt_text, link_attachment_url, children, quoted_post, reposted_post and
-- gif_url. Those were previously discarded, which made the posts route a text
-- only table. Store them so the library can render native-style previews.
--
-- Repost facades are stored separately from `posts`: they carry no text or
-- metrics, and mixing them into analytics would double-count reposts (the
-- original post already reports its own repost count).

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS link_attachment_url text,
  ADD COLUMN IF NOT EXISTS link_title text,
  ADD COLUMN IF NOT EXISTS link_site_name text,
  ADD COLUMN IF NOT EXISTS children jsonb,
  ADD COLUMN IF NOT EXISTS media_product_type text,
  ADD COLUMN IF NOT EXISTS is_quote_post boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quoted_post_id text,
  ADD COLUMN IF NOT EXISTS gif_url text,
  ADD COLUMN IF NOT EXISTS media_fetched_at timestamptz;

ALTER TABLE user_replies
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS link_attachment_url text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reposts_seeded_at timestamptz;

CREATE TABLE IF NOT EXISTS reposts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  threads_media_id text UNIQUE NOT NULL,
  permalink        text,
  shortcode        text,
  reposted_at      timestamptz NOT NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reposts_user_reposted_at
  ON reposts (user_id, reposted_at DESC);

ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_posts_user_media_published
  ON posts (user_id, published_at DESC)
  WHERE media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL');

-- The previous signature cannot be extended in place: adding p_only_media with
-- a default would leave two callable overloads and make existing named-argument
-- calls ambiguous.
DROP FUNCTION IF EXISTS get_posts_with_metrics(
  uuid, text, text, int, int, text[], timestamptz, timestamptz
);

CREATE FUNCTION get_posts_with_metrics(
  p_user_id uuid,
  p_sort_column text,
  p_sort_order text,
  p_limit int,
  p_offset int,
  p_media_types text[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_only_media boolean DEFAULT false
)
RETURNS TABLE (
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
  total_count bigint,
  text_full text,
  media_url text,
  thumbnail_url text,
  alt_text text,
  link_attachment_url text,
  link_title text,
  link_site_name text,
  children jsonb,
  media_product_type text,
  is_quote_post boolean,
  quoted_post_id text,
  gif_url text,
  topic_tag text
)
LANGUAGE sql STABLE
AS $$
  WITH latest_metrics AS (
    SELECT DISTINCT ON (pm.post_id)
      pm.post_id,
      pm.views,
      pm.likes,
      pm.replies,
      pm.reposts,
      pm.quotes,
      pm.shares
    FROM post_metrics pm
    INNER JOIN posts p ON p.id = pm.post_id
    WHERE p.user_id = p_user_id
      AND (p_media_types IS NULL OR p.media_type = ANY(p_media_types))
      AND (p_date_from IS NULL OR p.published_at >= p_date_from)
      AND (p_date_to IS NULL OR p.published_at < p_date_to + interval '1 day')
    ORDER BY pm.post_id, pm.fetched_at DESC
  ),
  joined AS (
    SELECT
      p.id,
      p.media_type,
      p.text_preview,
      p.permalink,
      p.published_at,
      COALESCE(m.views, 0)    AS views,
      COALESCE(m.likes, 0)    AS likes,
      COALESCE(m.replies, 0)  AS replies,
      COALESCE(m.reposts, 0)  AS reposts,
      COALESCE(m.quotes, 0)   AS quotes,
      COALESCE(m.shares, 0)   AS shares,
      CASE WHEN COALESCE(m.views, 0) > 0
        THEN (COALESCE(m.likes, 0) + COALESCE(m.replies, 0) + COALESCE(m.reposts, 0)
              + COALESCE(m.quotes, 0) + COALESCE(m.shares, 0))::numeric
              / m.views * 100
        ELSE 0
      END AS engagement_rate,
      COUNT(*) OVER () AS total_count,
      p.text_full,
      p.media_url,
      p.thumbnail_url,
      p.alt_text,
      p.link_attachment_url,
      p.link_title,
      p.link_site_name,
      p.children,
      p.media_product_type,
      p.is_quote_post,
      p.quoted_post_id,
      p.gif_url,
      p.topic_tag
    FROM posts p
    LEFT JOIN latest_metrics m ON m.post_id = p.id
    WHERE p.user_id = p_user_id
      AND (p_media_types IS NULL OR p.media_type = ANY(p_media_types))
      AND (p_date_from IS NULL OR p.published_at >= p_date_from)
      AND (p_date_to IS NULL OR p.published_at < p_date_to + interval '1 day')
      AND (NOT p_only_media OR p.media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL'))
  )
  SELECT *
  FROM joined
  ORDER BY
    CASE WHEN p_sort_order = 'asc' THEN
      CASE p_sort_column
        WHEN 'published_at'   THEN EXTRACT(epoch FROM joined.published_at)
        WHEN 'views'          THEN joined.views
        WHEN 'likes'          THEN joined.likes
        WHEN 'replies'        THEN joined.replies
        WHEN 'reposts'        THEN joined.reposts
        WHEN 'quotes'         THEN joined.quotes
        WHEN 'shares'         THEN joined.shares
        WHEN 'engagement_rate' THEN joined.engagement_rate
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_order <> 'asc' THEN
      CASE p_sort_column
        WHEN 'published_at'   THEN EXTRACT(epoch FROM joined.published_at)
        WHEN 'views'          THEN joined.views
        WHEN 'likes'          THEN joined.likes
        WHEN 'replies'        THEN joined.replies
        WHEN 'reposts'        THEN joined.reposts
        WHEN 'quotes'         THEN joined.quotes
        WHEN 'shares'         THEN joined.shares
        WHEN 'engagement_rate' THEN joined.engagement_rate
      END
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_posts_overview(p_user_id uuid)
RETURNS TABLE (
  total_posts bigint,
  total_views bigint,
  total_interactions bigint,
  engagement_rate numeric,
  media_breakdown jsonb,
  top_post jsonb
)
LANGUAGE sql STABLE
AS $$
  WITH latest_metrics AS (
    SELECT DISTINCT ON (pm.post_id)
      pm.post_id,
      pm.views,
      pm.likes,
      pm.replies,
      pm.reposts,
      pm.quotes,
      pm.shares
    FROM post_metrics pm
    INNER JOIN posts p ON p.id = pm.post_id
    WHERE p.user_id = p_user_id
    ORDER BY pm.post_id, pm.fetched_at DESC
  ),
  joined AS (
    SELECT
      p.id,
      p.media_type,
      p.text_preview,
      p.permalink,
      p.published_at,
      COALESCE(m.views, 0)   AS views,
      COALESCE(m.likes, 0)   AS likes,
      COALESCE(m.replies, 0) AS replies,
      COALESCE(m.reposts, 0) AS reposts,
      COALESCE(m.quotes, 0)  AS quotes,
      COALESCE(m.shares, 0)  AS shares,
      COALESCE(m.likes, 0) + COALESCE(m.replies, 0) + COALESCE(m.reposts, 0)
        + COALESCE(m.quotes, 0) + COALESCE(m.shares, 0) AS interactions
    FROM posts p
    LEFT JOIN latest_metrics m ON m.post_id = p.id
    WHERE p.user_id = p_user_id
  ),
  by_media AS (
    SELECT
      media_type,
      COUNT(*)::bigint AS posts,
      COALESCE(SUM(views), 0)::bigint AS views,
      CASE
        WHEN SUM(views) > 0 THEN SUM(interactions)::numeric / SUM(views) * 100
        ELSE 0
      END AS rate
    FROM joined
    GROUP BY media_type
  ),
  top AS (
    SELECT id, text_preview, media_type, views, permalink, published_at
    FROM joined
    ORDER BY views DESC, published_at DESC
    LIMIT 1
  )
  SELECT
    (SELECT COUNT(*) FROM joined)::bigint,
    (SELECT COALESCE(SUM(views), 0) FROM joined)::bigint,
    (SELECT COALESCE(SUM(interactions), 0) FROM joined)::bigint,
    (SELECT CASE WHEN COALESCE(SUM(views), 0) > 0
      THEN SUM(interactions)::numeric / SUM(views) * 100
      ELSE 0
    END FROM joined),
    (SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'media_type', media_type,
          'posts', posts,
          'views', views,
          'avg_views', CASE WHEN posts > 0 THEN ROUND(views::numeric / posts) ELSE 0 END,
          'engagement_rate', ROUND(rate, 2)
        )
        ORDER BY CASE media_type
          WHEN 'TEXT' THEN 1
          WHEN 'IMAGE' THEN 2
          WHEN 'VIDEO' THEN 3
          WHEN 'CAROUSEL' THEN 4
          ELSE 5
        END
      ),
      '[]'::jsonb
    ) FROM by_media),
    (SELECT to_jsonb(top) FROM top);
$$;
