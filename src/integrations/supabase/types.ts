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
          contact_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          whatsapp: string | null
        }
        Insert: {
          area?: string | null
          contact_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          whatsapp?: string | null
        }
        Update: {
          area?: string | null
          contact_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          whatsapp?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      avatars: {
        Row: {
          id: string
          is_active: boolean
          sort_order: number
          url: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          sort_order?: number
          url: string
        }
        Update: {
          id?: string
          is_active?: boolean
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      balance_transfers: {
        Row: {
          amount: number
          created_at: string
          fee_amount: number
          id: string
          note: string | null
          recipient_id: string
          recipient_received: number
          sender_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_amount?: number
          id?: string
          note?: string | null
          recipient_id: string
          recipient_received?: number
          sender_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_amount?: number
          id?: string
          note?: string | null
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
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
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
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          skill_level?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          skill_level?: number
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
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          user_id?: string
        }
        Relationships: []
      }
      commission_ledger: {
        Row: {
          agent_id: string | null
          commission_amount: number
          created_at: string
          id: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          commission_amount: number
          created_at?: string
          id?: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          commission_amount?: number
          created_at?: string
          id?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          amount: number
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          type: string
          used_count: number
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          type?: string
          used_count?: number
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          type?: string
          used_count?: number
        }
        Relationships: []
      }
      daily_bonuses: {
        Row: {
          amount: number
          claimed_on: string
          day_streak: number
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          claimed_on?: string
          day_streak?: number
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_on?: string
          day_streak?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      emoji_categories: {
        Row: {
          id: string
          name: string
          name_bn: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          name_bn?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          name_bn?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      emoji_items: {
        Row: {
          category_id: string | null
          emoji: string | null
          emoji_char: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          name_bn: string | null
          price: number
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          emoji?: string | null
          emoji_char?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          name_bn?: string | null
          price?: number
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          emoji?: string | null
          emoji_char?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          name_bn?: string | null
          price?: number
          sort_order?: number
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
          created_at: string
          emoji_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji_id: string
          id?: string
          user_id: string
        }
        Update: {
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
          entry_fee: number
          id: string
          is_winner: boolean
          mode: string | null
          prize_awarded: number
          room_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_fee?: number
          id?: string
          is_winner?: boolean
          mode?: string | null
          prize_awarded?: number
          room_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_fee?: number
          id?: string
          is_winner?: boolean
          mode?: string | null
          prize_awarded?: number
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_results_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_room_players: {
        Row: {
          id: string
          is_bot: boolean
          joined_at: string
          room_id: string
          seat: number | null
          user_id: string
        }
        Insert: {
          id?: string
          is_bot?: boolean
          joined_at?: string
          room_id: string
          seat?: number | null
          user_id: string
        }
        Update: {
          id?: string
          is_bot?: boolean
          joined_at?: string
          room_id?: string
          seat?: number | null
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
          code: string | null
          created_at: string
          current_players: number
          current_turn: number
          ended_at: string | null
          entry_fee: number
          host_id: string | null
          id: string
          is_private: boolean
          max_players: number
          mode: string
          prize_pool: number
          started_at: string | null
          state: Json
          status: string
          turn_seconds: number
          turn_started_at: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          current_players?: number
          current_turn?: number
          ended_at?: string | null
          entry_fee?: number
          host_id?: string | null
          id?: string
          is_private?: boolean
          max_players?: number
          mode: string
          prize_pool?: number
          started_at?: string | null
          state?: Json
          status?: string
          turn_seconds?: number
          turn_started_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          current_players?: number
          current_turn?: number
          ended_at?: string | null
          entry_fee?: number
          host_id?: string | null
          id?: string
          is_private?: boolean
          max_players?: number
          mode?: string
          prize_pool?: number
          started_at?: string | null
          state?: Json
          status?: string
          turn_seconds?: number
          turn_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          doc_image_url: string | null
          doc_number: string | null
          doc_type: string | null
          document_url: string | null
          full_name: string | null
          id: string
          notes: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          doc_image_url?: string | null
          doc_number?: string | null
          doc_type?: string | null
          document_url?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          doc_image_url?: string | null
          doc_number?: string | null
          doc_type?: string | null
          document_url?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
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
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          color: string | null
          created_at: string
          deposit_enabled: boolean
          display_name: string | null
          icon: string | null
          id: string
          instructions: string | null
          instructions_image_url: string | null
          is_active: boolean
          logo_url: string | null
          max_deposit: number
          max_withdraw: number
          method: string
          min_deposit: number
          min_withdraw: number
          receive_number: string | null
          sort_order: number
          withdraw_enabled: boolean
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string
          deposit_enabled?: boolean
          display_name?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          instructions_image_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          max_deposit?: number
          max_withdraw?: number
          method: string
          min_deposit?: number
          min_withdraw?: number
          receive_number?: string | null
          sort_order?: number
          withdraw_enabled?: boolean
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string
          deposit_enabled?: boolean
          display_name?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          instructions_image_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          max_deposit?: number
          max_withdraw?: number
          method?: string
          min_deposit?: number
          min_withdraw?: number
          receive_number?: string | null
          sort_order?: number
          withdraw_enabled?: boolean
        }
        Relationships: []
      }
      phone_otp_attempts: {
        Row: {
          action: string
          created_at: string
          id: string
          phone: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          phone: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          phone?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          game_id: string | null
          id: string
          is_blocked: boolean
          is_bot: boolean
          is_verified: boolean
          language: string
          level: number
          phone: string | null
          referred_by: string | null
          total_games: number
          total_losses: number
          total_wins: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          game_id?: string | null
          id: string
          is_blocked?: boolean
          is_bot?: boolean
          is_verified?: boolean
          language?: string
          level?: number
          phone?: string | null
          referred_by?: string | null
          total_games?: number
          total_losses?: number
          total_wins?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          game_id?: string | null
          id?: string
          is_blocked?: boolean
          is_bot?: boolean
          is_verified?: boolean
          language?: string
          level?: number
          phone?: string | null
          referred_by?: string | null
          total_games?: number
          total_losses?: number
          total_wins?: number
          updated_at?: string
          username?: string | null
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
          amount: number
          created_at: string
          earner_id: string
          id: string
          referred_id: string | null
          source: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          earner_id: string
          id?: string
          referred_id?: string | null
          source?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          earner_id?: string
          id?: string
          referred_id?: string | null
          source?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string | null
          status: string
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      royal_steps_rounds: {
        Row: {
          bet: number
          created_at: string
          current_step: number
          ended_at: string | null
          id: string
          max_steps: number
          multipliers: Json
          prize: number
          status: string
          trap_step: number
          user_id: string
        }
        Insert: {
          bet: number
          created_at?: string
          current_step?: number
          ended_at?: string | null
          id?: string
          max_steps: number
          multipliers: Json
          prize?: number
          status?: string
          trap_step: number
          user_id: string
        }
        Update: {
          bet?: number
          created_at?: string
          current_step?: number
          ended_at?: string | null
          id?: string
          max_steps?: number
          multipliers?: Json
          prize?: number
          status?: string
          trap_step?: number
          user_id?: string
        }
        Relationships: []
      }
      spin_history: {
        Row: {
          created_at: string
          id: string
          reward_amount: number
          reward_label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward_amount?: number
          reward_label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward_amount?: number
          reward_label?: string | null
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
          sender_id: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id?: string | null
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
          category: string | null
          created_at: string
          id: string
          last_message_at: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          placement: number | null
          prize_won: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          placement?: number | null
          prize_won?: number
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_no?: number
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          status?: string
          tournament_id: string
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
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          banner_url: string | null
          bots_enabled: boolean
          created_at: string
          description: string | null
          end_at: string | null
          entry_fee: number
          id: string
          max_players: number
          name: string
          prize_pool: number
          start_at: string
          status: string
        }
        Insert: {
          banner_url?: string | null
          bots_enabled?: boolean
          created_at?: string
          description?: string | null
          end_at?: string | null
          entry_fee?: number
          id?: string
          max_players?: number
          name: string
          prize_pool?: number
          start_at?: string
          status?: string
        }
        Update: {
          banner_url?: string | null
          bots_enabled?: boolean
          created_at?: string
          description?: string | null
          end_at?: string | null
          entry_fee?: number
          id?: string
          max_players?: number
          name?: string
          prize_pool?: number
          start_at?: string
          status?: string
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
          meta: Json | null
          method: string | null
          processed_at: string | null
          receiver_number: string | null
          reference: string | null
          sender_number: string | null
          status: string
          type: string
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
          meta?: Json | null
          method?: string | null
          processed_at?: string | null
          receiver_number?: string | null
          reference?: string | null
          sender_number?: string | null
          status?: string
          type: string
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
          meta?: Json | null
          method?: string | null
          processed_at?: string | null
          receiver_number?: string | null
          reference?: string | null
          sender_number?: string | null
          status?: string
          type?: string
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
      _royal_steps_config: { Args: never; Returns: Json }
      add_bot_to_room: { Args: { _room_id: string }; Returns: Json }
      admin_adjust_balance: {
        Args: {
          _amount: number
          _kind: string
          _note?: string
          _user_id: string
        }
        Returns: Json
      }
      admin_list_users: {
        Args: { _limit?: number; _q?: string }
        Returns: {
          created_at: string
          deposit_balance: number
          email: string
          game_id: string
          id: string
          is_blocked: boolean
          is_verified: boolean
          level: number
          phone: string
          roles: string[]
          total_games: number
          total_losses: number
          total_wins: number
          username: string
          winnings_balance: number
        }[]
      }
      admin_process_transaction: {
        Args: { _action: string; _txn_id: string }
        Returns: Json
      }
      admin_update_user: {
        Args: {
          _is_admin?: boolean
          _is_blocked?: boolean
          _is_verified?: boolean
          _user_id: string
          _username?: string
        }
        Returns: Json
      }
      advance_bye_winners: { Args: { _tid: string }; Returns: undefined }
      auto_advance_bot_matches: { Args: { _tid: string }; Returns: Json }
      auto_start_due_tournaments: { Args: never; Returns: Json }
      auto_timeout_turn: { Args: { _room_id: string }; Returns: Json }
      broadcast_notification: {
        Args: { _body: string; _title: string; _type?: string }
        Returns: Json
      }
      claim_daily_bonus: { Args: never; Returns: Json }
      claim_first_admin: { Args: never; Returns: string }
      create_friend_room: {
        Args: { _entry_fee: number; _max_players: number; _mode: string }
        Returns: Json
      }
      create_match_with_bots: {
        Args: { _entry_fee: number; _mode: string; _players: number }
        Returns: Json
      }
      enqueue_matchmaking: {
        Args: { _entry_fee: number; _mode: string }
        Returns: Json
      }
      fill_tournament_with_bots: { Args: { _tid: string }; Returns: number }
      finish_multi_game: {
        Args: { _room_id: string; _winner_id: string }
        Returns: Json
      }
      finish_solo_game:
        | {
            Args: {
              _duration: number
              _entry_fee: number
              _mode: string
              _prize: number
              _room_id: string
              _won: boolean
            }
            Returns: Json
          }
        | {
            Args: { _entry_fee?: number; _room_id: string; _won: boolean }
            Returns: Json
          }
      fx_play_bet: {
        Args: { _direction: string; _stake: number }
        Returns: Json
      }
      get_my_phone: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_friend_room: { Args: { _code: string }; Returns: Json }
      leave_matchmaking: { Args: never; Returns: Json }
      purchase_emoji: { Args: { _emoji_id: string }; Returns: Json }
      redeem_coupon: { Args: { _code: string }; Returns: Json }
      remove_bots_from_tournament: { Args: { _tid: string }; Returns: Json }
      report_match_winner: {
        Args: { _match_id: string; _winner_id: string }
        Returns: Json
      }
      royal_steps_cashout: { Args: { _id: string }; Returns: Json }
      royal_steps_start: { Args: { _bet: number }; Returns: Json }
      royal_steps_step: { Args: { _id: string }; Returns: Json }
      send_chat_message: { Args: { _body: string }; Returns: Json }
      spin_wheel: { Args: never; Returns: Json }
      start_tournament: { Args: { _tid: string }; Returns: Json }
      start_tournament_admin: { Args: { _tid: string }; Returns: Json }
      transfer_balance: {
        Args: { _amount: number; _recipient_game_id: string }
        Returns: Json
      }
      update_turn_timer: {
        Args: { _room_id: string; _turn: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "support" | "player"
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
      app_role: ["admin", "agent", "support", "player"],
    },
  },
} as const
