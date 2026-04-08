export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
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
      article_interactions: {
        Row: {
          article_url: string
          content: string | null
          created_at: string | null
          id: string
          interaction_type: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          article_url: string
          content?: string | null
          created_at?: string | null
          id?: string
          interaction_type: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          article_url?: string
          content?: string | null
          created_at?: string | null
          id?: string
          interaction_type?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_reads: {
        Row: {
          action_type: string
          article_url: string
          read_date: string
          user_id: string
        }
        Insert: {
          action_type: string
          article_url: string
          read_date?: string
          user_id: string
        }
        Update: {
          action_type?: string
          article_url?: string
          read_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cached_articles: {
        Row: {
          ai_summary: string | null
          ai_title: string | null
          article_date: string
          author: string
          category: string
          expires_at: string
          fetched_at: string | null
          id: string
          image_url: string
          likes: number | null
          original_id: string
          source: string
          source_url: string
          summary: string
          tags: string[] | null
          title: string
        }
        Insert: {
          ai_summary?: string | null
          ai_title?: string | null
          article_date: string
          author?: string
          category: string
          expires_at: string
          fetched_at?: string | null
          id?: string
          image_url: string
          likes?: number | null
          original_id: string
          source: string
          source_url: string
          summary: string
          tags?: string[] | null
          title: string
        }
        Update: {
          ai_summary?: string | null
          ai_title?: string | null
          article_date?: string
          author?: string
          category?: string
          expires_at?: string
          fetched_at?: string | null
          id?: string
          image_url?: string
          likes?: number | null
          original_id?: string
          source?: string
          source_url?: string
          summary?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          cover_image: string | null
          description: string | null
          expires_at: string
          genres: string[] | null
          id: string
          metacritic_score: number | null
          name: string
          opencritic_id: number | null
          opencritic_score: number | null
          platforms: string[] | null
          rawg_rating: number | null
          release_date: string | null
          slug: string
          steam_appid: number | null
          trending: boolean | null
        }
        Insert: {
          cover_image?: string | null
          description?: string | null
          expires_at: string
          genres?: string[] | null
          id: string
          metacritic_score?: number | null
          name: string
          opencritic_id?: number | null
          opencritic_score?: number | null
          platforms?: string[] | null
          rawg_rating?: number | null
          release_date?: string | null
          slug: string
          steam_appid?: number | null
          trending?: boolean | null
        }
        Update: {
          cover_image?: string | null
          description?: string | null
          expires_at?: string
          genres?: string[] | null
          id?: string
          metacritic_score?: number | null
          name?: string
          opencritic_id?: number | null
          opencritic_score?: number | null
          platforms?: string[] | null
          rawg_rating?: number | null
          release_date?: string | null
          slug?: string
          steam_appid?: number | null
          trending?: boolean | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean | null
          match_id: number
          predicted_team: string
          resolved_at: string | null
          user_id: string
          xp_bonus: number
          xp_participation: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          match_id: number
          predicted_team: string
          resolved_at?: string | null
          user_id: string
          xp_bonus?: number
          xp_participation?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          match_id?: number
          predicted_team?: string
          resolved_at?: string | null
          user_id?: string
          xp_bonus?: number
          xp_participation?: number
        }
        Relationships: [
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about_me: string | null
          avatar_url: string | null
          banner_url: string | null
          created_at: string | null
          daily_bonus_claimed_at: string | null
          daily_streak: number | null
          display_name: string | null
          email: string | null
          freeze_window_start: string | null
          id: string
          last_active_day: string | null
          level: number | null
          nameplate_url: string | null
          streak_frozen: boolean
          tier: number
          updated_at: string | null
          username: string | null
          xp: number | null
          xp_season: number
          xp_today: number
          xp_today_reset_date: string | null
          // Onboarding fields
          onboarding_completed: boolean
          onboarding_step: number
          onboarding_completed_at: string | null
          platforms: string[] | null
          skill_level: string
          fav_game_ids: string[] | null
          fav_genres: string[] | null
          avatar_type: string
          avatar_initials: string | null
          avatar_color: string | null
        }
        Insert: {
          about_me?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string | null
          daily_bonus_claimed_at?: string | null
          daily_streak?: number | null
          display_name?: string | null
          email?: string | null
          freeze_window_start?: string | null
          id: string
          last_active_day?: string | null
          level?: number | null
          nameplate_url?: string | null
          streak_frozen?: boolean
          tier?: number
          updated_at?: string | null
          username?: string | null
          xp?: number | null
          xp_season?: number
          xp_today?: number
          xp_today_reset_date?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          onboarding_completed_at?: string | null
          platforms?: string[] | null
          skill_level?: string
          fav_game_ids?: string[] | null
          fav_genres?: string[] | null
          avatar_type?: string
          avatar_initials?: string | null
          avatar_color?: string | null
        }
        Update: {
          about_me?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          created_at?: string | null
          daily_bonus_claimed_at?: string | null
          daily_streak?: number | null
          display_name?: string | null
          email?: string | null
          freeze_window_start?: string | null
          id?: string
          last_active_day?: string | null
          level?: number | null
          nameplate_url?: string | null
          streak_frozen?: boolean
          tier?: number
          updated_at?: string | null
          username?: string | null
          xp?: number | null
          xp_season?: number
          xp_today?: number
          xp_today_reset_date?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          onboarding_completed_at?: string | null
          platforms?: string[] | null
          skill_level?: string
          fav_game_ids?: string[] | null
          fav_genres?: string[] | null
          avatar_type?: string
          avatar_initials?: string | null
          avatar_color?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          end_date: string
          id: number
          is_active: boolean
          name: string
          start_date: string
        }
        Insert: {
          end_date: string
          id: number
          is_active?: boolean
          name: string
          start_date: string
        }
        Update: {
          end_date?: string
          id?: number
          is_active?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string | null
          avatar_url: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          profile_url: string | null
          provider: string
          provider_account_id: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          access_token?: string | null
          avatar_url?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          profile_url?: string | null
          provider: string
          provider_account_id: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          access_token?: string | null
          avatar_url?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          profile_url?: string | null
          provider?: string
          provider_account_id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      steam_profiles: {
        Row: {
          avatar_full: string | null
          country_code: string | null
          created_at: string | null
          id: string
          last_synced: string | null
          persona_name: string | null
          profile_url: string | null
          recent_playtime_2weeks: number | null
          steam_id: string
          total_games: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_full?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          last_synced?: string | null
          persona_name?: string | null
          profile_url?: string | null
          recent_playtime_2weeks?: number | null
          steam_id: string
          total_games?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_full?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          last_synced?: string | null
          persona_name?: string | null
          profile_url?: string | null
          recent_playtime_2weeks?: number | null
          steam_id?: string
          total_games?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trivia_attempts: {
        Row: {
          answers_json: Json | null
          completed_at: string | null
          id: string
          questions_json: Json
          quiz_date: string
          score: number | null
          user_id: string
          xp_awarded: number
        }
        Insert: {
          answers_json?: Json | null
          completed_at?: string | null
          id?: string
          questions_json: Json
          quiz_date: string
          score?: number | null
          user_id: string
          xp_awarded?: number
        }
        Update: {
          answers_json?: Json | null
          completed_at?: string | null
          id?: string
          questions_json?: Json
          quiz_date?: string
          score?: number | null
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "trivia_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_questions: {
        Row: {
          correct_index: number
          generated_at: string | null
          id: string
          options: Json
          question: string
          topic: string | null
        }
        Insert: {
          correct_index: number
          generated_at?: string | null
          id?: string
          options: Json
          question: string
          topic?: string | null
        }
        Update: {
          correct_index?: number
          generated_at?: string | null
          id?: string
          options?: Json
          question?: string
          topic?: string | null
        }
        Relationships: []
      }
      trivia_user_seen: {
        Row: {
          question_id: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          question_id: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          question_id?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_user_seen_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trivia_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_user_seen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_game_reviews: {
        Row: {
          created_at: string | null
          game_id: string
          helpful_votes: number | null
          id: string
          review_text: string | null
          star_rating: number
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          helpful_votes?: number | null
          id?: string
          review_text?: string | null
          star_rating: number
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          helpful_votes?: number | null
          id?: string
          review_text?: string | null
          star_rating?: number
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_game_reviews_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_games: {
        Row: {
          added_at: string | null
          game_name: string
          id: string
          image_url: string | null
          is_favorite: boolean | null
          platform: string | null
          playtime_hours: number | null
          user_id: string | null
        }
        Insert: {
          added_at?: string | null
          game_name: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          platform?: string | null
          playtime_hours?: number | null
          user_id?: string | null
        }
        Update: {
          added_at?: string | null
          game_name?: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          platform?: string | null
          playtime_hours?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_news_preferences: {
        Row: {
          created_at: string | null
          id: string
          tag: string
          user_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          tag: string
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          tag?: string
          user_id?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          claimed_at: string | null
          id: string
          redeemed_at: string | null
          reward_type: string
          reward_value: string | null
          season_id: number
          tier: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          redeemed_at?: string | null
          reward_type: string
          reward_value?: string | null
          season_id: number
          tier: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          redeemed_at?: string | null
          reward_type?: string
          reward_value?: string | null
          season_id?: number
          tier?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_titles: {
        Row: {
          active_title: string | null
          unlocked_titles: string[]
          user_id: string
        }
        Insert: {
          active_title?: string | null
          unlocked_titles?: string[]
          user_id: string
        }
        Update: {
          active_title?: string | null
          unlocked_titles?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_titles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          action_type: string
          created_at: string | null
          event_date: string
          id: string
          multiplier_applied: number | null
          ref_id: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          action_type: string
          created_at?: string | null
          event_date?: string
          id?: string
          multiplier_applied?: number | null
          ref_id?: string
          user_id: string
          xp_awarded: number
        }
        Update: {
          action_type?: string
          created_at?: string | null
          event_date?: string
          id?: string
          multiplier_applied?: number | null
          ref_id?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_unlocked_title: {
        Args: { title: string; uid: string }
        Returns: undefined
      }
      cleanup_expired_articles: { Args: never; Returns: undefined }
      increment_helpful_votes: {
        Args: { review_id: string }
        Returns: undefined
      }
      increment_xp: {
        Args: {
          delta_lifetime: number
          delta_season: number
          delta_today: number
          uid: string
        }
        Returns: undefined
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
