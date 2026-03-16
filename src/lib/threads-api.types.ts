export interface ThreadsUserProfile {
  id: string;
  username: string;
}

export type ThreadsMediaType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "CAROUSEL"
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
  values: { value: number; end_time?: string }[];
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
