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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          area: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      balance_transfers: {
        Row: {
          amount: number
          created_at: string
          fee_amount: number
          fee_percent: number
          id: string
          recipient_id: string
          recipient_received: number
          sender_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_amount?: number
          fee_percent?: number
          id?: string
          recipient_id: string
          recipient_received: number
          sender_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_amount?: number
          fee_percent?: number
          id?: string
          recipient_id?: string
          recipient_received?: number
          sender_id?: string
        }
        Relationships: []
      }
      balances: {
        Row: {
          deposit_balance: number
          updated_at: string
          user_id: string
          winnings_balance: number
        }
        Insert: {
          deposit_balance?: number
          updated_at?: string
          user_id: string
          winnings_balance?: number
        }
        Update: {
          deposit_balance?: number
          updated_at?: string
          user_id?: string
          winnings_balance?: number
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bots: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          skill_level: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          skill_level?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          skill_level?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_deleted: boolean
          is_pinned: boolean
          is_system: boolean
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          is_system?: boolean
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          is_system?: boolean
          user_id?: string
        }
        Relationships: []
      }
      commission_ledger: {
        Row: {
          commission_amount: number
          commission_percent: number
          created_at: string
          id: string
          mode: string
          player_count: number
          pot_amount: number
          room_id: string
          winner_id: string | null
        }
        Insert: {
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          id?: string
          mode: string
          player_count?: number
          pot_amount?: number
          room_id: string
          winner_id?: string | null
        }
        Update: {
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          id?: string
          mode?: string
          player_count?: number
          pot_amount?: number
          room_id?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          amount: number
          coupon_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          amount: number
          coupon_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          coupon_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          amount: number
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_uses: number
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          used_count: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          used_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      daily_bonuses: {
        Row: {
          amount: number
          claimed_on: string
          created_at: string
          day_streak: number
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_on?: string
          created_at?: string
          day_streak?: number
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_on?: string
          created_at?: string
          day_streak?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      emoji_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      emoji_items: {
        Row: {
          category_id: string | null
          created_at: string
          emoji_char: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          name_bn: string | null
          price: number
          sort_order: number
          use_count: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          emoji_char?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          name_bn?: string | null
          price?: number
          sort_order?: number
          use_count?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          emoji_char?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          name_bn?: string | null
          price?: number
          sort_order?: number
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "emoji_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "emoji_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      emoji_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          emoji_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          emoji_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          emoji_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emoji_purchases_emoji_id_fkey"
            columns: ["emoji_id"]
            isOneToOne: false
            referencedRelation: "emoji_items"
            referencedColumns: ["id"]
          },
        ]
      }
      game_results: {
        Row: {
          created_at: string
          duration_seconds: number | null
          entry_fee: number
          id: string
          mode: string
          player_ids: string[]
          prize_awarded: number
          room_id: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          entry_fee?: number
          id?: string
          mode: string
          player_ids?: string[]
          prize_awarded?: number
          room_id: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          entry_fee?: number
          id?: string
          mode?: string
          player_ids?: string[]
          prize_awarded?: number
          room_id?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      game_room_players: {
        Row: {
          id: string
          is_bot: boolean
          joined_at: string
          room_id: string
          seat: number
          user_id: string
        }
        Insert: {
          id?: string
          is_bot?: boolean
          joined_at?: string
          room_id: string
          seat: number
          user_id: string
        }
        Update: {
          id?: string
          is_bot?: boolean
          joined_at?: string
          room_id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          code: string
          created_at: string
          current_players: number
          current_turn: number
          ended_at: string | null
          entry_fee: number
          host_id: string
          id: string
          max_players: number
          mode: string
          prize_pool: number
          started_at: string | null
          state: Json
          status: Database["public"]["Enums"]["room_status"]
          turn_started_at: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_players?: number
          current_turn?: number
          ended_at?: string | null
          entry_fee?: number
          host_id: string
          id?: string
          max_players?: number
          mode: string
          prize_pool?: number
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["room_status"]
          turn_started_at?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_players?: number
          current_turn?: number
          ended_at?: string | null
          entry_fee?: number
          host_id?: string
          id?: string
          max_players?: number
          mode?: string
          prize_pool?: number
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["room_status"]
          turn_started_at?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          doc_image_url: string | null
          doc_number: string
          doc_type: string
          id: string
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          doc_image_url?: string | null
          doc_number: string
          doc_type: string
          id?: string
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          doc_image_url?: string | null
          doc_number?: string
          doc_type?: string
          id?: string
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          color: string | null
          deposit_enabled: boolean
          display_name: string
          icon: string | null
          id: string
          instructions: string | null
          max_deposit: number
          max_withdraw: number
          method: Database["public"]["Enums"]["payment_method"]
          min_deposit: number
          min_withdraw: number
          receive_number: string | null
          sort_order: number
          updated_at: string
          withdraw_enabled: boolean
        }
        Insert: {
          color?: string | null
          deposit_enabled?: boolean
          display_name: string
          icon?: string | null
          id?: string
          instructions?: string | null
          max_deposit?: number
          max_withdraw?: number
          method: Database["public"]["Enums"]["payment_method"]
          min_deposit?: number
          min_withdraw?: number
          receive_number?: string | null
          sort_order?: number
          updated_at?: string
          withdraw_enabled?: boolean
        }
        Update: {
          color?: string | null
          deposit_enabled?: boolean
          display_name?: string
          icon?: string | null
          id?: string
          instructions?: string | null
          max_deposit?: number
          max_withdraw?: number
          method?: Database["public"]["Enums"]["payment_method"]
          min_deposit?: number
          min_withdraw?: number
          receive_number?: string | null
          sort_order?: number
          updated_at?: string
          withdraw_enabled?: boolean
        }
        Relationships: []
      }
      phone_otp_attempts: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          phone: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          phone: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          phone?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          game_id: string
          id: string
          is_blocked: boolean
          is_bot: boolean
          is_verified: boolean
          language: Database["public"]["Enums"]["app_language"]
          level: number
          phone: string | null
          referred_by: string | null
          total_games: number
          total_losses: number
          total_wins: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          game_id: string
          id: string
          is_blocked?: boolean
          is_bot?: boolean
          is_verified?: boolean
          language?: Database["public"]["Enums"]["app_language"]
          level?: number
          phone?: string | null
          referred_by?: string | null
          total_games?: number
          total_losses?: number
          total_wins?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          game_id?: string
          id?: string
          is_blocked?: boolean
          is_bot?: boolean
          is_verified?: boolean
          language?: Database["public"]["Enums"]["app_language"]
          level?: number
          phone?: string | null
          referred_by?: string | null
          total_games?: number
          total_losses?: number
          total_wins?: number
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_earnings: {
        Row: {
          commission_earned: number
          commission_percent: number
          created_at: string
          deposit_amount: number
          earner_id: string
          id: string
          level: number
          source_deposit_id: string | null
          source_user_id: string
        }
        Insert: {
          commission_earned: number
          commission_percent: number
          created_at?: string
          deposit_amount: number
          earner_id: string
          id?: string
          level: number
          source_deposit_id?: string | null
          source_user_id: string
        }
        Update: {
          commission_earned?: number
          commission_percent?: number
          created_at?: string
          deposit_amount?: number
          earner_id?: string
          id?: string
          level?: number
          source_deposit_id?: string | null
          source_user_id?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          room_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string
          room_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          room_id?: string
          user_id?: string
        }
        Relationships: []
      }
      spin_history: {
        Row: {
          created_at: string
          id: string
          reward_amount: number
          reward_label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward_amount: number
          reward_label: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward_amount?: number
          reward_label?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_admin: boolean
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          last_message_at: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          id: string
          joined_at: string
          placement: number | null
          prize_won: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          placement?: number | null
          prize_won?: number
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          placement?: number | null
          prize_won?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          created_at: string
          id: string
          match_no: number
          player1_id: string | null
          player2_id: string | null
          round: number
          status: string
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_no: number
          player1_id?: string | null
          player2_id?: string | null
          round: number
          status?: string
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_no?: number
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          status?: string
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          entry_fee: number
          id: string
          max_players: number
          name: string
          prize_pool: number
          start_at: string
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          entry_fee?: number
          id?: string
          max_players?: number
          name: string
          prize_pool?: number
          start_at: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          entry_fee?: number
          id?: string
          max_players?: number
          name?: string
          prize_pool?: number
          start_at?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          admin_note: string | null
          amount: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          created_at: string
          external_txn_id: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          processed_at: string | null
          processed_by: string | null
          receiver_number: string | null
          reference: string | null
          sender_number: string | null
          status: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          external_txn_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          processed_at?: string | null
          processed_by?: string | null
          receiver_number?: string | null
          reference?: string | null
          sender_number?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string
          external_txn_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          processed_at?: string | null
          processed_by?: string | null
          receiver_number?: string | null
          reference?: string | null
          sender_number?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_phone: { Args: { _uid: string }; Returns: string }
      check_level_gate: { Args: { _entry_fee: number }; Returns: Json }
      claim_daily_bonus: { Args: never; Returns: Json }
      claim_first_admin: { Args: never; Returns: string }
      finish_solo_game: {
        Args: {
          _duration?: number
          _entry_fee: number
          _mode: string
          _prize: number
          _room_id: string
          _won: boolean
        }
        Returns: Json
      }
      generate_game_id: { Args: never; Returns: string }
      get_my_phone: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_emoji: { Args: { _emoji_id: string }; Returns: Json }
      redeem_coupon: { Args: { _code: string }; Returns: Json }
      send_chat_message: { Args: { _body: string }; Returns: string }
      spin_wheel: { Args: never; Returns: Json }
      transfer_balance: {
        Args: { _amount: number; _recipient_game_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_language: "bn" | "en"
      app_role: "player" | "admin" | "agent" | "support"
      coupon_type: "cash" | "deposit_bonus" | "spin"
      kyc_status: "pending" | "approved" | "rejected"
      notification_type:
        | "deposit_approved"
        | "deposit_rejected"
        | "withdraw_approved"
        | "withdraw_rejected"
        | "transfer_received"
        | "referral_bonus"
        | "announcement"
        | "system"
      payment_method:
        | "bkash"
        | "nagad"
        | "rocket"
        | "bank"
        | "system"
        | "fincra"
      room_status: "waiting" | "playing" | "finished" | "cancelled"
      ticket_status: "open" | "pending" | "resolved" | "closed"
      tournament_status: "upcoming" | "live" | "completed" | "cancelled"
      txn_status:
        | "pending"
        | "approved"
        | "rejected"
        | "completed"
        | "cancelled"
      txn_type:
        | "deposit"
        | "withdraw"
        | "game_entry"
        | "game_win"
        | "refund"
        | "referral_bonus"
        | "admin_adjust"
        | "transfer_in"
        | "transfer_out"
        | "bonus"
        | "prize"
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
    Enums: {
      app_language: ["bn", "en"],
      app_role: ["player", "admin", "agent", "support"],
      coupon_type: ["cash", "deposit_bonus", "spin"],
      kyc_status: ["pending", "approved", "rejected"],
      notification_type: [
        "deposit_approved",
        "deposit_rejected",
        "withdraw_approved",
        "withdraw_rejected",
        "transfer_received",
        "referral_bonus",
        "announcement",
        "system",
      ],
      payment_method: ["bkash", "nagad", "rocket", "bank", "system", "fincra"],
      room_status: ["waiting", "playing", "finished", "cancelled"],
      ticket_status: ["open", "pending", "resolved", "closed"],
      tournament_status: ["upcoming", "live", "completed", "cancelled"],
      txn_status: ["pending", "approved", "rejected", "completed", "cancelled"],
      txn_type: [
        "deposit",
        "withdraw",
        "game_entry",
        "game_win",
        "refund",
        "referral_bonus",
        "admin_adjust",
        "transfer_in",
        "transfer_out",
        "bonus",
        "prize",
      ],
    },
  },
} as const
