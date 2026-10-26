import type { Json } from "@/lib/supabase/database.types";

/**
 * Latest metric snapshot joined onto a post. Media and link fields are
 * optional because analytics-only callers (today hub, format analysis) do not
 * need them.
 */
export interface PostRow {
  id: string;
  media_type: string;
  text_preview: string | null;
  permalink: string | null;
  published_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
  engagement_rate: number;
  text_full?: string | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  link_attachment_url?: string | null;
  link_title?: string | null;
  link_site_name?: string | null;
  children?: Json;
  media_product_type?: string | null;
  is_quote_post?: boolean | null;
  quoted_post_id?: string | null;
  gif_url?: string | null;
  topic_tag?: string | null;
}
