
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin','agent','support','player');

-- ============= HELPER: updated_at trigger =============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE,
  game_id text UNIQUE,
  avatar_url text,
  level int NOT NULL DEFAULT 1,
  total_wins int NOT NULL DEFAULT 0,
  total_losses int NOT NULL DEFAULT 0,
  total_games int NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  is_bot boolean NOT NULL DEFAULT false,
  phone text,
  referred_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============= BALANCES =============
CREATE TABLE public.balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_balance numeric NOT NULL DEFAULT 0,
  winnings_balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_balances_updated BEFORE UPDATE ON public.balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= TRANSACTIONS =============
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  method text,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  external_txn_id text,
  meta jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============= BALANCE TRANSFERS =============
CREATE TABLE public.balance_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id),
  to_user uuid NOT NULL REFERENCES auth.users(id),
  amount numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.balance_transfers ENABLE ROW LEVEL SECURITY;

-- ============= COMMISSION LEDGER =============
CREATE TABLE public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES auth.users(id),
  user_id uuid REFERENCES auth.users(id),
  commission_amount numeric NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

-- ============= REFUNDS =============
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  transaction_id uuid REFERENCES public.transactions(id),
  amount numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- ============= GAME ROOMS =============
CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  mode text NOT NULL,
  entry_fee numeric NOT NULL DEFAULT 0,
  max_players int NOT NULL DEFAULT 2,
  current_players int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting',
  host_id uuid REFERENCES auth.users(id),
  is_private boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.game_room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat int,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
ALTER TABLE public.game_room_players ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  mode text,
  entry_fee numeric NOT NULL DEFAULT 0,
  prize_awarded numeric NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

-- ============= TOURNAMENTS =============
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  entry_fee numeric NOT NULL DEFAULT 0,
  prize_pool numeric NOT NULL DEFAULT 0,
  max_players int NOT NULL DEFAULT 16,
  status text NOT NULL DEFAULT 'upcoming',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position int,
  prize_awarded numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round int NOT NULL DEFAULT 1,
  player_1 uuid REFERENCES auth.users(id),
  player_2 uuid REFERENCES auth.users(id),
  winner uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- ============= CHAT =============
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ============= NOTIFICATIONS =============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============= SUPPORT =============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- ============= KYC =============
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  document_type text,
  document_number text,
  document_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= PAYMENT SETTINGS =============
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,
  account_name text,
  account_number text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- ============= AGENTS / BOTS / BANNERS / COUPONS =============
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  contact_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  skill_level int NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  subtitle text,
  image_url text,
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'cash',
  amount numeric NOT NULL DEFAULT 0,
  max_uses int NOT NULL DEFAULT 1,
  used_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- ============= EMOJI SHOP =============
CREATE TABLE public.emoji_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE public.emoji_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.emoji_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.emoji_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  emoji text,
  image_url text,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE public.emoji_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.emoji_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji_id uuid NOT NULL REFERENCES public.emoji_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, emoji_id)
);
ALTER TABLE public.emoji_purchases ENABLE ROW LEVEL SECURITY;

-- ============= REFERRAL EARNINGS =============
CREATE TABLE public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  earner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES auth.users(id),
  amount numeric NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

-- ============= DAILY BONUSES / SPIN =============
CREATE TABLE public.daily_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  day_streak int NOT NULL DEFAULT 1,
  claimed_on date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, claimed_on)
);
ALTER TABLE public.daily_bonuses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.spin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_label text,
  reward_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;

-- ============= APP SETTINGS =============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= PHONE OTP =============
CREATE TABLE public.phone_otp_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_otp_attempts ENABLE ROW LEVEL SECURITY;

-- ============= AVATARS GALLERY =============
CREATE TABLE public.avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- ============= RLS POLICIES =============
-- Profiles: everyone can read; users update own; admins all
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- User roles: users see own; only admin manages
CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Balances: own + admin
CREATE POLICY "balances_own" ON public.balances FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "balances_admin_all" ON public.balances FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Transactions
CREATE POLICY "tx_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tx_insert_own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_admin_all" ON public.transactions FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Balance transfers
CREATE POLICY "bt_own" ON public.balance_transfers FOR SELECT USING (auth.uid() IN (from_user, to_user) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bt_insert" ON public.balance_transfers FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "bt_admin" ON public.balance_transfers FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Commission ledger: admin/agent only
CREATE POLICY "cl_own_agent" ON public.commission_ledger FOR SELECT USING (auth.uid() = agent_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cl_admin" ON public.commission_ledger FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Refunds
CREATE POLICY "ref_own" ON public.refunds FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ref_admin" ON public.refunds FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Game rooms: public read; authenticated insert; players/admin update
CREATE POLICY "rooms_read" ON public.game_rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON public.game_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "rooms_update" ON public.game_rooms FOR UPDATE USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "rooms_admin_all" ON public.game_rooms FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "grp_read" ON public.game_room_players FOR SELECT USING (true);
CREATE POLICY "grp_insert_self" ON public.game_room_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "grp_delete_self" ON public.game_room_players FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "gr_read_own" ON public.game_results FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "gr_admin" ON public.game_results FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Tournaments: public read; admin write
CREATE POLICY "tour_read" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "tour_admin" ON public.tournaments FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "te_read" ON public.tournament_entries FOR SELECT USING (true);
CREATE POLICY "te_insert_self" ON public.tournament_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "te_admin" ON public.tournament_entries FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "tm_read" ON public.tournament_matches FOR SELECT USING (true);
CREATE POLICY "tm_admin" ON public.tournament_matches FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Chat
CREATE POLICY "chat_read" ON public.chat_messages FOR SELECT USING (is_deleted = false OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chat_insert_auth" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_update_own" ON public.chat_messages FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chat_admin" ON public.chat_messages FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Notifications: own + admin send
CREATE POLICY "notif_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_admin" ON public.notifications FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Support
CREATE POLICY "st_own" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
CREATE POLICY "st_insert_own" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "st_update_own_admin" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE POLICY "sm_read_ticket_owner" ON public.support_messages FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support')))
);
CREATE POLICY "sm_insert" ON public.support_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support')))
);

-- KYC
CREATE POLICY "kyc_own" ON public.kyc_submissions FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "kyc_insert_own" ON public.kyc_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kyc_update_own_admin" ON public.kyc_submissions FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "kyc_admin" ON public.kyc_submissions FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Public-config tables: everyone can read; admin writes
CREATE POLICY "ps_read" ON public.payment_settings FOR SELECT USING (true);
CREATE POLICY "ps_admin" ON public.payment_settings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ag_read" ON public.agents FOR SELECT USING (true);
CREATE POLICY "ag_admin" ON public.agents FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "bots_read" ON public.bots FOR SELECT USING (true);
CREATE POLICY "bots_admin" ON public.bots FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ban_read" ON public.banners FOR SELECT USING (true);
CREATE POLICY "ban_admin" ON public.banners FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "cp_read_active" ON public.coupons FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cp_admin" ON public.coupons FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ec_read" ON public.emoji_categories FOR SELECT USING (true);
CREATE POLICY "ec_admin" ON public.emoji_categories FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ei_read" ON public.emoji_items FOR SELECT USING (true);
CREATE POLICY "ei_admin" ON public.emoji_items FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ep_own" ON public.emoji_purchases FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ep_insert_own" ON public.emoji_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "re_own" ON public.referral_earnings FOR SELECT USING (auth.uid() = earner_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "re_admin" ON public.referral_earnings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "db_own" ON public.daily_bonuses FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "db_insert_own" ON public.daily_bonuses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sh_own" ON public.spin_history FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "sh_insert_own" ON public.spin_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "as_read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "as_admin" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "poa_admin" ON public.phone_otp_attempts FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "av_read" ON public.avatars FOR SELECT USING (true);
CREATE POLICY "av_admin" ON public.avatars FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= AUTO PROFILE + BALANCE + ROLE ON SIGNUP =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_name text;
  uname text;
  gid text;
BEGIN
  base_name := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email,'@',1),
    'user'
  );
  uname := base_name || substr(replace(NEW.id::text,'-',''),1,4);
  gid := upper(substr(replace(NEW.id::text,'-',''),1,8));

  INSERT INTO public.profiles (id, username, game_id, avatar_url)
  VALUES (NEW.id, uname, gid, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.balances (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= BACKFILL EXISTING USERS =============
INSERT INTO public.profiles (id, username, game_id)
SELECT u.id,
       COALESCE(split_part(u.email,'@',1),'user') || substr(replace(u.id::text,'-',''),1,4),
       upper(substr(replace(u.id::text,'-',''),1,8))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.balances (user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'player' FROM auth.users ON CONFLICT DO NOTHING;

-- ============= GRANT ADMIN to bidgame24@gmail.com =============
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'bidgame24@gmail.com'
ON CONFLICT DO NOTHING;

-- ============= SEED app_settings =============
INSERT INTO public.app_settings (key, value) VALUES
  ('site_name', '"Ludo Coins"'::jsonb),
  ('commission_rate', '10'::jsonb),
  ('min_withdraw', '100'::jsonb),
  ('min_deposit', '50'::jsonb)
ON CONFLICT DO NOTHING;

-- ============= REALTIME =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
