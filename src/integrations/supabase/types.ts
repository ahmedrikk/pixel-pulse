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
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          email: string | null
          avatar_url: string | null
          about_me: string | null
          created_at: string
          updated_at: string
          xp: number
          level: number
          daily_bonus_claimed_at: string | null
          banner_url: string | null
          nameplate_url: string | null
          daily_streak: number | null
          // Battle Pass XP fields
          xp_today: number
          xp_today_reset_date: string | null
          xp_season: number
          tier: number
          streak_frozen: boolean
          freeze_window_start: string | null
          last_active_day: string | null
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          email?: string | null
          avatar_url?: string | null
          about_me?: string | null
          created_at?: string
          updated_at?: string
          xp?: number
          level?: number
          daily_bonus_claimed_at?: string | null
          banner_url?: string | null
          nameplate_url?: string | null
          daily_streak?: number | null
          // Battle Pass XP fields
          xp_today?: number
          xp_today_reset_date?: string | null
          xp_season?: number
          tier?: number
          streak_frozen?: boolean
          freeze_window_start?: string | null
          last_active_day?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          email?: string | null
          avatar_url?: string | null
          about_me?: string | null
          created_at?: string
          updated_at?: string
          xp?: number
          level?: number
          daily_bonus_claimed_at?: string | null
          banner_url?: string | null
          nameplate_url?: string | null
          daily_streak?: number | null
          // Battle Pass XP fields
          xp_today?: number
          xp_today_reset_date?: string | null
          xp_season?: number
          tier?: number
          streak_frozen?: boolean
          freeze_window_start?: string | null
          last_active_day?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          id: number
          name: string
          start_date: string
          end_date: string
          is_active: boolean
        }
        Insert: {
          id: number
          name: string
          start_date: string
          end_date: string
          is_active?: boolean
        }
        Update: {
          id?: number
          name?: string
          start_date?: string
          end_date?: string
          is_active?: boolean
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          id: string
          user_id: string
          action_type: string
          ref_id: string
          xp_awarded: number
          multiplier_applied: number | null
          event_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: string
          ref_id?: string
          xp_awarded: number
          multiplier_applied?: number | null
          event_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: string
          ref_id?: string
          xp_awarded?: number
          multiplier_applied?: number | null
          event_date?: string
          created_at?: string
        }
        Relationships: [{ foreignKeyName: "xp_events_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      trivia_questions: {
        Row: {
          id: string
          question: string
          options: Json
          correct_index: number
          topic: string | null
          generated_at: string
        }
        Insert: {
          id?: string
          question: string
          options: Json
          correct_index: number
          topic?: string | null
          generated_at?: string
        }
        Update: {
          id?: string
          question?: string
          options?: Json
          correct_index?: number
          topic?: string | null
          generated_at?: string
        }
        Relationships: []
      }
      trivia_user_seen: {
        Row: {
          user_id: string
          question_id: string
          seen_at: string
        }
        Insert: {
          user_id: string
          question_id: string
          seen_at?: string
        }
        Update: {
          user_id?: string
          question_id?: string
          seen_at?: string
        }
        Relationships: [
          { foreignKeyName: "trivia_user_seen_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "trivia_user_seen_question_id_fkey"; columns: ["question_id"]; referencedRelation: "trivia_questions"; referencedColumns: ["id"] }
        ]
      }
      trivia_attempts: {
        Row: {
          id: string
          user_id: string
          quiz_date: string
          questions_json: Json
          answers_json: Json | null
          score: number | null
          xp_awarded: number
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          quiz_date: string
          questions_json: Json
          answers_json?: Json | null
          score?: number | null
          xp_awarded?: number
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          quiz_date?: string
          questions_json?: Json
          answers_json?: Json | null
          score?: number | null
          xp_awarded?: number
          completed_at?: string | null
        }
        Relationships: [{ foreignKeyName: "trivia_attempts_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: number
          predicted_team: string
          is_correct: boolean | null
          xp_participation: number
          xp_bonus: number
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          match_id: number
          predicted_team: string
          is_correct?: boolean | null
          xp_participation?: number
          xp_bonus?: number
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          match_id?: number
          predicted_team?: string
          is_correct?: boolean | null
          xp_participation?: number
          xp_bonus?: number
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: [{ foreignKeyName: "predictions_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      article_reads: {
        Row: {
          user_id: string
          article_url: string
          action_type: string
          read_date: string
        }
        Insert: {
          user_id: string
          article_url: string
          action_type: string
          read_date?: string
        }
        Update: {
          user_id?: string
          article_url?: string
          action_type?: string
          read_date?: string
        }
        Relationships: [{ foreignKeyName: "article_reads_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      article_interactions: {
        Row: {
          id: string
          user_id: string
          article_url: string
          interaction_type: 'react' | 'comment'
          content: string | null
          upvote_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          article_url: string
          interaction_type: 'react' | 'comment'
          content?: string | null
          upvote_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          article_url?: string
          interaction_type?: 'react' | 'comment'
          content?: string | null
          upvote_count?: number
          created_at?: string
        }
        Relationships: [{ foreignKeyName: "article_interactions_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      user_rewards: {
        Row: {
          id: string
          user_id: string
          season_id: number
          tier: number
          reward_type: string
          reward_value: string | null
          claimed_at: string
          redeemed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          season_id: number
          tier: number
          reward_type: string
          reward_value?: string | null
          claimed_at?: string
          redeemed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          season_id?: number
          tier?: number
          reward_type?: string
          reward_value?: string | null
          claimed_at?: string
          redeemed_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "user_rewards_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "user_rewards_season_id_fkey"; columns: ["season_id"]; referencedRelation: "seasons"; referencedColumns: ["id"] }
        ]
      }
      user_titles: {
        Row: {
          user_id: string
          active_title: string | null
          unlocked_titles: string[]
        }
        Insert: {
          user_id: string
          active_title?: string | null
          unlocked_titles?: string[]
        }
        Update: {
          user_id?: string
          active_title?: string | null
          unlocked_titles?: string[]
        }
        Relationships: [{ foreignKeyName: "user_titles_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      social_accounts: {
        Row: {
          id: string
          user_id: string
          provider: 'steam' | 'epic' | 'discord' | 'twitch' | 'youtube'
          provider_account_id: string
          username: string | null
          avatar_url: string | null
          profile_url: string | null
          access_token: string | null
          refresh_token: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: 'steam' | 'epic' | 'discord' | 'twitch' | 'youtube'
          provider_account_id: string
          username?: string | null
          avatar_url?: string | null
          profile_url?: string | null
          access_token?: string | null
          refresh_token?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'steam' | 'epic' | 'discord' | 'twitch' | 'youtube'
          provider_account_id?: string
          username?: string | null
          avatar_url?: string | null
          profile_url?: string | null
          access_token?: string | null
          refresh_token?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      steam_profiles: {
        Row: {
          id: string
          user_id: string
          steam_id: string
          persona_name: string | null
          profile_url: string | null
          avatar_full: string | null
          country_code: string | null
          total_games: number
          recent_playtime_2weeks: number
          last_synced: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          steam_id: string
          persona_name?: string | null
          profile_url?: string | null
          avatar_full?: string | null
          country_code?: string | null
          total_games?: number
          recent_playtime_2weeks?: number
          last_synced?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          steam_id?: string
          persona_name?: string | null
          profile_url?: string | null
          avatar_full?: string | null
          country_code?: string | null
          total_games?: number
          recent_playtime_2weeks?: number
          last_synced?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_games: {
        Row: {
          id: string
          user_id: string
          game_name: string
          platform: string | null
          playtime_hours: number
          is_favorite: boolean
          added_at: string
          image_url: string | null
        }
        Insert: {
          id?: string
          user_id: string
          game_name: string
          platform?: string | null
          playtime_hours?: number
          is_favorite?: boolean
          added_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          game_name?: string
          platform?: string | null
          playtime_hours?: number
          is_favorite?: boolean
          added_at?: string
        }
        Relationships: []
      }
      user_news_preferences: {
        Row: {
          id: string
          user_id: string
          tag: string
          weight: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tag: string
          weight?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tag?: string
          weight?: number
          created_at?: string
        }
        Relationships: []
      }
      cached_articles: {
        Row: {
          id: string
          original_id: string
          title: string
          summary: string
          source_url: string
          image_url: string
          category: string
          source: string
          author: string
          ai_title: string | null
          ai_summary: string | null
          tags: string[] | null
          likes: number
          article_date: string
          fetched_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          original_id: string
          title: string
          summary: string
          source_url: string
          image_url: string
          category: string
          source: string
          author?: string
          ai_title?: string | null
          ai_summary?: string | null
          tags?: string[] | null
          likes?: number
          article_date: string
          fetched_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          original_id?: string
          title?: string
          summary?: string
          source_url?: string
          image_url?: string
          category?: string
          source?: string
          author?: string
          ai_title?: string | null
          ai_summary?: string | null
          tags?: string[] | null
          likes?: number
          article_date?: string
          fetched_at?: string
          expires_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_unlocked_title: {
        Args: { uid: string; title: string }
        Returns: void
      }
      increment_xp: {
        Args: { uid: string; delta_today: number; delta_season: number; delta_lifetime: number }
        Returns: void
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
  public: {
    Enums: {},
  },
} as const
