import type { StoredPostMediaType } from "@/lib/post-media-type";

export interface ThreadsUserProfile {
  id: string;
  username: string;
}

export type ThreadsMediaType =
  | StoredPostMediaType
  | `${StoredPostMediaType}_POST`
  | "CAROUSEL_ALBUM"
  | "REPOST_FACADE";

export interface ThreadsPost {
  id: string;
  media_product_type?: string | null;
  media_type: ThreadsMediaType;
  media_url?: string | null;
  text: string;
  timestamp: string;
  permalink: string;
  shortcode: string;
  thumbnail_url?: string | null;
  children?: { data: { id: string }[] } | null;
  is_quote_post?: boolean | null;
  quoted_post?: { id: string } | string | null;
  reposted_post?: { id: string } | string | null;
  alt_text?: string | null;
  link_attachment_url?: string | null;
  gif_url?: string | null;
  topic_tag?: string | null;
}

/** Fields needed to render a post's media, fetched on demand when a CDN URL expires. */
export interface ThreadsPostMedia {
  id: string;
  media_type: ThreadsMediaType;
  media_url?: string | null;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  gif_url?: string | null;
  children?: { data: { id: string }[] } | null;
}

export interface ThreadsPostInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export interface ThreadsUserInsightValue {
  name: string;
  values?: { value: number; end_time?: string }[];
  total_value?: {
    value?: number;
    breakdowns?: {
      dimension_keys?: string[];
      results?: {
        dimension_values?: string[];
        value: number;
      }[];
    }[];
  };
}

export interface ThreadsDemographicBreakdown {
  dimension: string;
  values: { key: string; value: number }[];
}

export interface ThreadsTokenRefreshResult {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ThreadsReply {
  id: string;
  text: string;
  timestamp: string;
}

export interface ThreadsUserReply {
  id: string;
  text?: string | null;
  timestamp: string;
  permalink?: string | null;
  shortcode?: string | null;
  media_type?: ThreadsMediaType | "TEXT_POST" | "AUDIO";
  media_url?: string | null;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  link_attachment_url?: string | null;
  root_post?: { id: string } | string | null;
  replied_to?: { id: string } | string | null;
  is_reply?: boolean;
  is_reply_owned_by_me?: boolean;
}

export interface ThreadsPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}
