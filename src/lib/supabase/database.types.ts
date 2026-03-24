export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      backfill_job_events: {
        Row: {
          created_at: string
          details: Json
          id: string
          job_id: string
          level: string
          message: string
          stage: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          job_id: string
          level: string
          message: string
          stage: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          job_id?: string
          level?: string
          message?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "backfill_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "backfill_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      backfill_jobs: {
        Row: {
          completed_at: string | null
          current_post_id: string | null
          created_at: string | null
          id: string
          last_error_message: string | null
          last_error_payload: Json | null
          last_error_status: number | null
          last_heartbeat_at: string
          processed_posts: number | null
          stage: string
          started_at: string | null
          status: string
          total_posts: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_post_id?: string | null
          created_at?: string | null
          id?: string
          last_error_message?: string | null
          last_error_payload?: Json | null
          last_error_status?: number | null
          last_heartbeat_at?: string
          processed_posts?: number | null
          stage?: string
          started_at?: string | null
          status?: string
          total_posts?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_post_id?: string | null
          created_at?: string | null
          id?: string
          last_error_message?: string | null
          last_error_payload?: Json | null
          last_error_status?: number | null
          last_heartbeat_at?: string
          processed_posts?: number | null
          stage?: string
          started_at?: string | null
          status?: string
          total_posts?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backfill_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          date: string
          followers_count: number | null
          id: string
          user_id: string
          views: number | null
        }
        Insert: {
          date: string
          followers_count?: number | null
          id?: string
          user_id: string
          views?: number | null
        }
        Update: {
          date?: string
          followers_count?: number | null
          id?: string
          user_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      demographics: {
        Row: {
          dimension: string
          fetched_at: string | null
          id: string
          key: string
          user_id: string
          value: number
        }
        Insert: {
          dimension: string
          fetched_at?: string | null
          id?: string
          key: string
          user_id: string
          value: number
        }
        Update: {
          dimension?: string
          fetched_at?: string | null
          id?: string
          key?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "demographics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          fetched_at: string | null
          id: string
          likes: number | null
          post_id: string
          quotes: number | null
          replies: number | null
          reposts: number | null
          shares: number | null
          views: number | null
        }
        Insert: {
          fetched_at?: string | null
          id?: string
          likes?: number | null
          post_id: string
          quotes?: number | null
          replies?: number | null
          reposts?: number | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          fetched_at?: string | null
          id?: string
          likes?: number | null
          post_id?: string
          quotes?: number | null
          replies?: number | null
          reposts?: number | null
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_replies: {
        Row: {
          fetched_at: string | null
          id: string
          post_id: string
          replied_at: string | null
          text: string | null
          threads_reply_id: string
          word_count: number | null
        }
        Insert: {
          fetched_at?: string | null
          id?: string
          post_id: string
          replied_at?: string | null
          text?: string | null
          threads_reply_id: string
          word_count?: number | null
        }
        Update: {
          fetched_at?: string | null
          id?: string
          post_id?: string
          replied_at?: string | null
          text?: string | null
          threads_reply_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string | null
          id: string
          media_type: string
          permalink: string | null
          published_at: string
          text_preview: string | null
          threads_media_id: string
          topic_tag: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_type: string
          permalink?: string | null
          published_at: string
          text_preview?: string | null
          threads_media_id: string
          topic_tag?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          media_type?: string
          permalink?: string | null
          published_at?: string
          text_preview?: string | null
          threads_media_id?: string
          topic_tag?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          threads_user_id: string
          token_expires_at: string
          username: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          threads_user_id: string
          token_expires_at: string
          username?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          threads_user_id?: string
          token_expires_at?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_posts_with_metrics:
        | {
            Args: {
              p_limit: number
              p_offset: number
              p_sort_column: string
              p_sort_order: string
              p_user_id: string
            }
            Returns: {
              engagement_rate: number
              id: string
              likes: number
              media_type: string
              permalink: string
              published_at: string
              quotes: number
              replies: number
              reposts: number
              shares: number
              text_preview: string
              total_count: number
              views: number
            }[]
          }
        | {
            Args: {
              p_date_from?: string
              p_date_to?: string
              p_limit: number
              p_media_types?: string[]
              p_offset: number
              p_sort_column: string
              p_sort_order: string
              p_user_id: string
            }
            Returns: {
              engagement_rate: number
              id: string
              likes: number
              media_type: string
              permalink: string
              published_at: string
              quotes: number
              replies: number
              reposts: number
              shares: number
              text_preview: string
              total_count: number
              views: number
            }[]
          }
      get_timing_heatmap_data: {
        Args: { p_user_id: string }
        Returns: {
          likes: number
          published_at: string
          quotes: number
          replies: number
          reposts: number
          shares: number
          views: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
