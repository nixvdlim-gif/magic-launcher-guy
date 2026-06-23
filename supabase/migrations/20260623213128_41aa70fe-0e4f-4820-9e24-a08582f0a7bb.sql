CREATE TYPE public.app_role AS ENUM ('player', 'admin', 'agent', 'support');
CREATE TYPE public.app_language AS ENUM ('bn', 'en');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT, phone TEXT,
  language public.app_language NOT NULL DEFAULT 'bn',
  level INT NOT NULL DEFAULT 1,
  total_wins INT NOT NULL DEFAULT 0, total_losses INT NOT NULL DEFAULT 0, total_games INT NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false, is_blocked BOOLEAN NOT NULL DEFAULT false,
  referred_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  winnings_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balances TO authenticated;
GRANT ALL ON public.balances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.generate_game_id()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE new_id TEXT; attempts INT := 0;
BEGIN
  LOOP
    new_id := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE game_id = new_id);
    attempts := attempts + 1;
    IF attempts > 50 THEN RAISE EXCEPTION 'Could not generate unique Game ID'; END IF;
  END LOOP;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER balances_touch BEFORE UPDATE ON public.balances FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users view other profiles basic" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own balance" ON public.balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage balances" ON public.balances FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref_code text; v_ref_id uuid;
BEGIN
  v_ref_code := NEW.raw_user_meta_data ->> 'referral_code';
  IF v_ref_code IS NOT NULL AND length(v_ref_code) > 0 THEN
    SELECT id INTO v_ref_id FROM public.profiles WHERE game_id = v_ref_code;
  END IF;
  INSERT INTO public.profiles (id, game_id, username, phone, referred_by)
  VALUES (NEW.id, public.generate_game_id(),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'phone', v_ref_id);
  INSERT INTO public.balances (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_game_id() FROM PUBLIC, anon, authenticated;

CREATE TYPE public.txn_type AS ENUM ('deposit','withdraw','game_entry','game_win','refund','referral_bonus','admin_adjust','transfer_in','transfer_out','bonus','prize');
CREATE TYPE public.txn_status AS ENUM ('pending','approved','rejected','completed','cancelled');
CREATE TYPE public.payment_method AS ENUM ('bkash','nagad','rocket','bank','system');

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type public.txn_type NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'system',
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status public.txn_status NOT NULL DEFAULT 'pending',
  sender_number TEXT, receiver_number TEXT, external_txn_id TEXT,
  bank_account_name TEXT, bank_account_number TEXT, bank_name TEXT,
  reference TEXT, admin_note TEXT,
  processed_by UUID, processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_user ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_txn_status ON public.transactions(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pending transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND type IN ('deposit','withdraw') AND processed_by IS NULL AND processed_at IS NULL);
CREATE POLICY "Admins manage transactions" ON public.transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_txn_touch BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method public.payment_method NOT NULL UNIQUE,
  display_name TEXT NOT NULL, receive_number TEXT, instructions TEXT,
  min_deposit NUMERIC(12,2) NOT NULL DEFAULT 50,
  max_deposit NUMERIC(12,2) NOT NULL DEFAULT 25000,
  min_withdraw NUMERIC(12,2) NOT NULL DEFAULT 100,
  max_withdraw NUMERIC(12,2) NOT NULL DEFAULT 25000,
  deposit_enabled BOOLEAN NOT NULL DEFAULT true,
  withdraw_enabled BOOLEAN NOT NULL DEFAULT true,
  icon TEXT, color TEXT, sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read payment settings" ON public.payment_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage payment settings" ON public.payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_payment_settings_touch BEFORE UPDATE ON public.payment_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.payment_settings (method, display_name, receive_number, instructions, icon, color, sort_order) VALUES
  ('bkash', 'bKash', '01700000000', 'Send Money অপশনে গিয়ে নাম্বারে টাকা পাঠান, তারপর ট্রানজেকশন আইডি দিন।', '📱', '#E2136E', 1),
  ('nagad', 'Nagad',  '01800000000', 'Send Money অপশনে গিয়ে নাম্বারে টাকা পাঠান, তারপর ট্রানজেকশন আইডি দিন।', '💸', '#F37A20', 2),
  ('rocket','Rocket', '017000000001','Send Money অপশনে গিয়ে নাম্বারে টাকা পাঠান, তারপর ট্রানজেকশন আইডি দিন।', '🚀', '#8C3494', 3),
  ('bank',  'Bank Transfer', NULL, 'A/C: 1234567890, Bank Asia, Dhaka — ব্রাঞ্চ যেকোনো।', '🏦', '#1E3A8A', 4);

CREATE OR REPLACE FUNCTION public.handle_transaction_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_deposit NUMERIC; current_winnings NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT deposit_balance, winnings_balance INTO current_deposit, current_winnings
      FROM public.balances WHERE user_id = NEW.user_id FOR UPDATE;
    IF NEW.type = 'deposit' THEN
      UPDATE public.balances SET deposit_balance = deposit_balance + NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
    ELSIF NEW.type = 'withdraw' THEN
      IF current_deposit < NEW.amount THEN RAISE EXCEPTION 'Insufficient deposit balance for withdrawal'; END IF;
      UPDATE public.balances SET deposit_balance = deposit_balance - NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
    ELSIF NEW.type = 'prize' THEN
      UPDATE public.balances SET winnings_balance = winnings_balance + NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
    ELSIF NEW.type = 'game_entry' THEN
      IF current_winnings >= NEW.amount THEN
        UPDATE public.balances SET winnings_balance = winnings_balance - NEW.amount, updated_at = now() WHERE user_id = NEW.user_id;
      ELSE
        IF (current_winnings + current_deposit) < NEW.amount THEN RAISE EXCEPTION 'Insufficient balance for game entry'; END IF;
        UPDATE public.balances SET winnings_balance = 0, deposit_balance = deposit_balance - (NEW.amount - current_winnings), updated_at = now() WHERE user_id = NEW.user_id;
      END IF;
    END IF;
    NEW.processed_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_transaction_status BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_status();

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_id UUID; admin_count INT;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count > 0 THEN RETURN 'admin_exists'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (caller_id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'granted';
END; $$;

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage app settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_app_settings_touch BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.app_settings (key, value) VALUES
  ('twilio', '{"account_sid":"","auth_token":"","verify_service_sid":"","enabled":false}'::jsonb),
  ('transfer', '{"fee_percent": 5, "min_amount": 50, "max_amount": 25000, "enabled": true}'::jsonb),
  ('referral', '{"l1_percent": 5, "l2_percent": 2, "l3_percent": 1, "enabled": true, "min_deposit": 100}'::jsonb)
  ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.phone_otp_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL, ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_phone_otp_attempts_phone_time ON public.phone_otp_attempts(phone, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_otp_attempts TO authenticated;
GRANT ALL ON public.phone_otp_attempts TO service_role;
ALTER TABLE public.phone_otp_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view otp attempts" ON public.phone_otp_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.balance_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL, recipient_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  fee_percent NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  recipient_received NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balance_transfers TO authenticated;
GRANT ALL ON public.balance_transfers TO service_role;
ALTER TABLE public.balance_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transfers" ON public.balance_transfers FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Admins manage transfers" ON public.balance_transfers FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  earner_id UUID NOT NULL, source_user_id UUID NOT NULL, source_deposit_id UUID,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 3),
  deposit_amount NUMERIC NOT NULL,
  commission_percent NUMERIC NOT NULL,
  commission_earned NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_earnings TO authenticated;
GRANT ALL ON public.referral_earnings TO service_role;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referral earnings" ON public.referral_earnings FOR SELECT TO authenticated USING (auth.uid() = earner_id);
CREATE POLICY "Admins manage referral earnings" ON public.referral_earnings FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.transfer_balance(_recipient_game_id text, _amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sender uuid := auth.uid(); v_recipient uuid; v_settings jsonb;
  v_fee_percent numeric; v_min numeric; v_max numeric; v_enabled boolean;
  v_fee numeric; v_received numeric; v_winnings numeric; v_xfer_id uuid;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'transfer';
  v_fee_percent := COALESCE((v_settings->>'fee_percent')::numeric, 5);
  v_min := COALESCE((v_settings->>'min_amount')::numeric, 50);
  v_max := COALESCE((v_settings->>'max_amount')::numeric, 25000);
  v_enabled := COALESCE((v_settings->>'enabled')::boolean, true);
  IF NOT v_enabled THEN RAISE EXCEPTION 'Transfers disabled'; END IF;
  IF _amount < v_min OR _amount > v_max THEN RAISE EXCEPTION 'Amount must be between % and %', v_min, v_max; END IF;
  SELECT id INTO v_recipient FROM public.profiles WHERE game_id = _recipient_game_id;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient = v_sender THEN RAISE EXCEPTION 'Cannot transfer to yourself'; END IF;
  v_fee := round(_amount * v_fee_percent / 100, 2);
  v_received := _amount - v_fee;
  SELECT winnings_balance INTO v_winnings FROM public.balances WHERE user_id = v_sender FOR UPDATE;
  IF v_winnings IS NULL OR v_winnings < _amount THEN RAISE EXCEPTION 'Insufficient winnings balance'; END IF;
  UPDATE public.balances SET winnings_balance = winnings_balance - _amount, updated_at = now() WHERE user_id = v_sender;
  INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_recipient, v_received)
    ON CONFLICT (user_id) DO UPDATE SET winnings_balance = public.balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
  INSERT INTO public.balance_transfers (sender_id, recipient_id, amount, fee_percent, fee_amount, recipient_received)
    VALUES (v_sender, v_recipient, _amount, v_fee_percent, v_fee, v_received) RETURNING id INTO v_xfer_id;
  INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference) VALUES
    (v_sender, 'transfer_out', 'system', _amount, 'approved', now(), v_xfer_id::text),
    (v_recipient, 'transfer_in', 'system', v_received, 'approved', now(), v_xfer_id::text);
  RETURN jsonb_build_object('transfer_id', v_xfer_id, 'fee', v_fee, 'received', v_received);
END; $$;
REVOKE ALL ON FUNCTION public.transfer_balance(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_balance(text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_referral_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings jsonb; v_enabled boolean; v_min numeric; v_pcts numeric[];
  v_current uuid; v_referrer uuid; v_lvl int; v_pct numeric; v_amt numeric;
BEGIN
  IF NEW.type <> 'deposit' OR NEW.status <> 'approved' OR OLD.status = 'approved' THEN RETURN NEW; END IF;
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'referral';
  v_enabled := COALESCE((v_settings->>'enabled')::boolean, true);
  v_min := COALESCE((v_settings->>'min_deposit')::numeric, 100);
  IF NOT v_enabled OR NEW.amount < v_min THEN RETURN NEW; END IF;
  v_pcts := ARRAY[
    COALESCE((v_settings->>'l1_percent')::numeric, 5),
    COALESCE((v_settings->>'l2_percent')::numeric, 2),
    COALESCE((v_settings->>'l3_percent')::numeric, 1)
  ];
  v_current := NEW.user_id;
  FOR v_lvl IN 1..3 LOOP
    SELECT referred_by INTO v_referrer FROM public.profiles WHERE id = v_current;
    EXIT WHEN v_referrer IS NULL;
    v_pct := v_pcts[v_lvl];
    IF v_pct > 0 THEN
      v_amt := round(NEW.amount * v_pct / 100, 2);
      INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_referrer, v_amt)
        ON CONFLICT (user_id) DO UPDATE SET winnings_balance = public.balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
      INSERT INTO public.referral_earnings (earner_id, source_user_id, source_deposit_id, level, deposit_amount, commission_percent, commission_earned)
        VALUES (v_referrer, NEW.user_id, NEW.id, v_lvl, NEW.amount, v_pct, v_amt);
      INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
        VALUES (v_referrer, 'referral_bonus', 'system', v_amt, 'approved', now(), NEW.id::text);
    END IF;
    v_current := v_referrer;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER process_referral_bonus_trg AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.process_referral_bonus();

CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL, subtitle TEXT, image_url TEXT, link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can view active banners" ON public.banners FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage banners" ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_banners_updated BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TYPE public.notification_type AS ENUM ('deposit_approved','deposit_rejected','withdraw_approved','withdraw_rejected','transfer_received','referral_bonus','announcement','system');
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL, body TEXT, link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TYPE public.ticket_status AS ENUM ('open','pending','resolved','closed');
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status public.ticket_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_user ON public.support_tickets(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage tickets" ON public.support_tickets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL, is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msgs_ticket ON public.support_messages(ticket_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ticket messages" ON public.support_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "Users send to own tickets" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_admin = false AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "Admins manage support messages" ON public.support_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.notify_on_txn_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title TEXT; v_type public.notification_type;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.type = 'deposit' AND NEW.status = 'approved' THEN v_type := 'deposit_approved'; v_title := 'Deposit approved — ৳' || NEW.amount;
  ELSIF NEW.type = 'deposit' AND NEW.status = 'rejected' THEN v_type := 'deposit_rejected'; v_title := 'Deposit rejected — ৳' || NEW.amount;
  ELSIF NEW.type = 'withdraw' AND NEW.status = 'approved' THEN v_type := 'withdraw_approved'; v_title := 'Withdraw approved — ৳' || NEW.amount;
  ELSIF NEW.type = 'withdraw' AND NEW.status = 'rejected' THEN v_type := 'withdraw_rejected'; v_title := 'Withdraw rejected — ৳' || NEW.amount;
  ELSIF NEW.type = 'transfer_in' AND NEW.status = 'approved' THEN v_type := 'transfer_received'; v_title := 'Received ৳' || NEW.amount;
  ELSIF NEW.type = 'referral_bonus' AND NEW.status = 'approved' THEN v_type := 'referral_bonus'; v_title := 'Referral bonus +৳' || NEW.amount;
  ELSE RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES (NEW.user_id, v_type, v_title, COALESCE(NEW.admin_note, ''), '/transactions');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_txn AFTER UPDATE OF status ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.notify_on_txn_status();

CREATE TYPE public.tournament_status AS ENUM ('upcoming','live','completed','cancelled');
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, banner_url text,
  entry_fee numeric NOT NULL DEFAULT 0, prize_pool numeric NOT NULL DEFAULT 0,
  max_players integer NOT NULL DEFAULT 16, start_at timestamptz NOT NULL,
  status public.tournament_status NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view tournaments" ON public.tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tournaments" ON public.tournaments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tournaments_touch BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, placement integer, prize_won numeric NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_entries TO authenticated;
GRANT ALL ON public.tournament_entries TO service_role;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own entries" ON public.tournament_entries FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users join tournaments" ON public.tournament_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage entries" ON public.tournament_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL, mode text NOT NULL,
  entry_fee numeric NOT NULL DEFAULT 0, prize_awarded numeric NOT NULL DEFAULT 0,
  winner_id uuid, player_ids uuid[] NOT NULL DEFAULT '{}',
  duration_seconds integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_results_winner ON public.game_results(winner_id);
CREATE INDEX idx_game_results_players ON public.game_results USING gin(player_ids);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_results TO authenticated;
GRANT ALL ON public.game_results TO service_role;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own games" ON public.game_results FOR SELECT TO authenticated USING (auth.uid() = winner_id OR auth.uid() = ANY(player_ids) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage game results" ON public.game_results FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TYPE public.room_status AS ENUM ('waiting','playing','finished','cancelled');
CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, mode text NOT NULL,
  entry_fee numeric NOT NULL DEFAULT 0, prize_pool numeric NOT NULL DEFAULT 0,
  max_players integer NOT NULL DEFAULT 2, current_players integer NOT NULL DEFAULT 0,
  host_id uuid NOT NULL,
  status public.room_status NOT NULL DEFAULT 'waiting',
  started_at timestamptz, ended_at timestamptz, winner_id uuid,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_turn integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_rooms_status ON public.game_rooms(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_rooms TO authenticated;
GRANT ALL ON public.game_rooms TO service_role;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view rooms" ON public.game_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create rooms" ON public.game_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host or admin updates rooms" ON public.game_rooms FOR UPDATE TO authenticated USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete rooms" ON public.game_rooms FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rooms_touch BEFORE UPDATE ON public.game_rooms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.game_room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, seat integer NOT NULL, is_bot boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id), UNIQUE (room_id, seat)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_room_players TO authenticated;
GRANT ALL ON public.game_room_players TO service_role;
ALTER TABLE public.game_room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view seats" ON public.game_room_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users seat themselves" ON public.game_room_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave own seat" ON public.game_room_players FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_players;
ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.game_room_players REPLICA IDENTITY FULL;

CREATE TABLE public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, avatar_url text,
  skill_level integer NOT NULL DEFAULT 5 CHECK (skill_level BETWEEN 1 AND 10),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bots TO authenticated;
GRANT ALL ON public.bots TO service_role;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active bots" ON public.bots FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage bots" ON public.bots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bots_touch BEFORE UPDATE ON public.bots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text, whatsapp text, area text, notes text,
  is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active agents" ON public.agents FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage agents" ON public.agents FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_agents_touch BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TYPE public.kyc_status AS ENUM ('pending','approved','rejected');
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, doc_type text NOT NULL, doc_number text NOT NULL,
  doc_image_url text, selfie_url text,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own kyc" ON public.kyc_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users submit kyc" ON public.kyc_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins manage kyc" ON public.kyc_submissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_kyc_touch BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.daily_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  claimed_on date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL, day_streak integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claimed_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_bonuses TO authenticated;
GRANT ALL ON public.daily_bonuses TO service_role;
ALTER TABLE public.daily_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bonuses" ON public.daily_bonuses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage bonuses" ON public.daily_bonuses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.spin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, reward_amount numeric NOT NULL, reward_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spin_history TO authenticated;
GRANT ALL ON public.spin_history TO service_role;
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own spins" ON public.spin_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage spins" ON public.spin_history FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TYPE public.coupon_type AS ENUM ('cash','deposit_bonus','spin');
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type public.coupon_type NOT NULL DEFAULT 'cash',
  amount numeric NOT NULL, max_uses integer NOT NULL DEFAULT 1, used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(), valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_coupons_touch BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, amount numeric NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage redemptions" ON public.coupon_redemptions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_yesterday record; v_streak int := 1; v_amount numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.daily_bonuses WHERE user_id = v_user AND claimed_on = CURRENT_DATE) THEN RAISE EXCEPTION 'Already claimed today'; END IF;
  SELECT day_streak INTO v_yesterday FROM public.daily_bonuses WHERE user_id = v_user AND claimed_on = CURRENT_DATE - 1;
  IF FOUND THEN v_streak := LEAST(v_yesterday.day_streak + 1, 7); END IF;
  v_amount := CASE v_streak WHEN 1 THEN 5 WHEN 2 THEN 10 WHEN 3 THEN 15 WHEN 4 THEN 20 WHEN 5 THEN 30 WHEN 6 THEN 50 ELSE 100 END;
  INSERT INTO public.daily_bonuses (user_id, amount, day_streak) VALUES (v_user, v_amount, v_streak);
  INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
  INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at) VALUES (v_user, 'bonus', 'system', v_amount, 'approved', now());
  RETURN jsonb_build_object('amount', v_amount, 'streak', v_streak);
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_c record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_c FROM public.coupons WHERE code = _code AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid coupon'; END IF;
  IF v_c.valid_until IS NOT NULL AND v_c.valid_until < now() THEN RAISE EXCEPTION 'Coupon expired'; END IF;
  IF v_c.used_count >= v_c.max_uses THEN RAISE EXCEPTION 'Coupon limit reached'; END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = v_c.id AND user_id = v_user) THEN RAISE EXCEPTION 'Already redeemed'; END IF;
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, amount) VALUES (v_c.id, v_user, v_c.amount);
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_c.id;
  IF v_c.type = 'cash' THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, v_c.amount)
      ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
  ELSIF v_c.type = 'deposit_bonus' THEN
    INSERT INTO public.balances (user_id, deposit_balance) VALUES (v_user, v_c.amount)
      ON CONFLICT (user_id) DO UPDATE SET deposit_balance = balances.deposit_balance + EXCLUDED.deposit_balance, updated_at = now();
  END IF;
  INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference) VALUES (v_user, 'bonus', 'system', v_c.amount, 'approved', now(), v_c.code);
  RETURN jsonb_build_object('amount', v_c.amount, 'type', v_c.type);
END; $$;

CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_today_count int;
  v_rolls numeric[] := ARRAY[1,2,5,10,20,50,0,5]; v_amount numeric; v_label text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT count(*) INTO v_today_count FROM public.spin_history WHERE user_id = v_user AND created_at > CURRENT_DATE;
  IF v_today_count >= 1 THEN RAISE EXCEPTION 'Daily spin already used'; END IF;
  v_amount := v_rolls[1 + floor(random() * array_length(v_rolls,1))::int];
  v_label := CASE WHEN v_amount = 0 THEN 'Try again' ELSE '৳' || v_amount END;
  INSERT INTO public.spin_history (user_id, reward_amount, reward_label) VALUES (v_user, v_amount, v_label);
  IF v_amount > 0 THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, v_amount)
      ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at) VALUES (v_user, 'bonus', 'system', v_amount, 'approved', now());
  END IF;
  RETURN jsonb_build_object('amount', v_amount, 'label', v_label);
END; $$;

CREATE OR REPLACE FUNCTION public.finish_solo_game(_room_id text, _mode text, _entry_fee numeric, _prize numeric, _won boolean, _duration int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_dep numeric; v_win numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _entry_fee < 0 OR _prize < 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _entry_fee > 0 THEN
    SELECT deposit_balance, winnings_balance INTO v_dep, v_win FROM public.balances WHERE user_id = v_user FOR UPDATE;
    IF (COALESCE(v_dep,0) + COALESCE(v_win,0)) < _entry_fee THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    IF v_win >= _entry_fee THEN
      UPDATE public.balances SET winnings_balance = winnings_balance - _entry_fee, updated_at = now() WHERE user_id = v_user;
    ELSE
      UPDATE public.balances SET winnings_balance = 0, deposit_balance = deposit_balance - (_entry_fee - v_win), updated_at = now() WHERE user_id = v_user;
    END IF;
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_user, 'game_entry', 'system', _entry_fee, 'approved', now(), _room_id);
  END IF;
  IF _won AND _prize > 0 THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, _prize)
      ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_user, 'prize', 'system', _prize, 'approved', now(), _room_id);
  END IF;
  UPDATE public.profiles SET total_games = total_games + 1,
    total_wins = total_wins + CASE WHEN _won THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN _won THEN 0 ELSE 1 END,
    updated_at = now() WHERE id = v_user;
  INSERT INTO public.game_results (room_id, mode, entry_fee, prize_awarded, winner_id, player_ids, duration_seconds)
    VALUES (_room_id, _mode, _entry_fee, CASE WHEN _won THEN _prize ELSE 0 END,
      CASE WHEN _won THEN v_user ELSE NULL END, ARRAY[v_user], _duration);
  RETURN jsonb_build_object('won', _won, 'prize', CASE WHEN _won THEN _prize ELSE 0 END);
END; $$;

CREATE TABLE public.emoji_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, name_bn text, sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emoji_categories TO authenticated;
GRANT ALL ON public.emoji_categories TO service_role;
ALTER TABLE public.emoji_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active categories" ON public.emoji_categories FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage emoji categories" ON public.emoji_categories FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.emoji_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.emoji_categories(id) ON DELETE CASCADE,
  name text NOT NULL, name_bn text, emoji_char text, image_url text,
  price numeric NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0, use_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emoji_items TO authenticated;
GRANT ALL ON public.emoji_items TO service_role;
ALTER TABLE public.emoji_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active emoji items" ON public.emoji_items FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage emoji items" ON public.emoji_items FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.emoji_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  emoji_id uuid NOT NULL REFERENCES public.emoji_items(id) ON DELETE CASCADE,
  amount_paid numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, emoji_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emoji_purchases TO authenticated;
GRANT ALL ON public.emoji_purchases TO service_role;
ALTER TABLE public.emoji_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own emoji purchases" ON public.emoji_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage purchases" ON public.emoji_purchases FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.purchase_emoji(_emoji_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_item record; v_win numeric; v_dep numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_item FROM public.emoji_items WHERE id = _emoji_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emoji not available'; END IF;
  IF EXISTS (SELECT 1 FROM public.emoji_purchases WHERE user_id = v_user AND emoji_id = _emoji_id) THEN RAISE EXCEPTION 'Already owned'; END IF;
  IF v_item.price > 0 THEN
    SELECT winnings_balance, deposit_balance INTO v_win, v_dep FROM public.balances WHERE user_id = v_user FOR UPDATE;
    IF (COALESCE(v_win,0) + COALESCE(v_dep,0)) < v_item.price THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    IF v_win >= v_item.price THEN
      UPDATE public.balances SET winnings_balance = winnings_balance - v_item.price, updated_at = now() WHERE user_id = v_user;
    ELSE
      UPDATE public.balances SET winnings_balance = 0, deposit_balance = deposit_balance - (v_item.price - v_win), updated_at = now() WHERE user_id = v_user;
    END IF;
  END IF;
  INSERT INTO public.emoji_purchases (user_id, emoji_id, amount_paid) VALUES (v_user, _emoji_id, v_item.price);
  IF v_item.price > 0 THEN
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_user, 'game_entry', 'system', v_item.price, 'approved', now(), 'emoji:' || _emoji_id::text);
  END IF;
  RETURN jsonb_build_object('owned', true, 'price', v_item.price);
END $$;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false, is_system boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_idx ON public.chat_messages (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view chat" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage chat" ON public.chat_messages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.send_chat_message(_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_recent int; v_id uuid; v_clean text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clean := btrim(_body);
  IF length(v_clean) < 1 THEN RAISE EXCEPTION 'Empty message'; END IF;
  IF length(v_clean) > 300 THEN RAISE EXCEPTION 'Message too long (max 300)'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND is_blocked = true) THEN RAISE EXCEPTION 'You are blocked'; END IF;
  SELECT count(*) INTO v_recent FROM public.chat_messages WHERE user_id = v_user AND created_at > now() - interval '2 seconds';
  IF v_recent > 0 THEN RAISE EXCEPTION 'Too fast — wait a moment'; END IF;
  INSERT INTO public.chat_messages (user_id, body) VALUES (v_user, v_clean) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
