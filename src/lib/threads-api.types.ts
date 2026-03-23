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
  media_type: ThreadsMediaType;
  text: string;
  timestamp: string;
  permalink: string;
  shortcode: string;
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

export interface ThreadsPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}
