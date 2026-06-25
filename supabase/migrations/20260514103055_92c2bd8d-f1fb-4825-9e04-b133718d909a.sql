
-- Enums
CREATE TYPE public.txn_type AS ENUM ('deposit','withdraw','game_entry','game_win','refund','referral_bonus','admin_adjust');
CREATE TYPE public.txn_status AS ENUM ('pending','approved','rejected','completed','cancelled');
CREATE TYPE public.payment_method AS ENUM ('bkash','nagad','rocket','bank','system');

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type public.txn_type NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'system',
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status public.txn_status NOT NULL DEFAULT 'pending',
  sender_number TEXT,
  receiver_number TEXT,
  external_txn_id TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  reference TEXT,
  admin_note TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_txn_user ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_txn_status ON public.transactions(status, created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pending transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND type IN ('deposit','withdraw')
    AND processed_by IS NULL
    AND processed_at IS NULL
  );

CREATE POLICY "Admins manage transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_txn_touch
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Payment settings (admin controlled)
CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method public.payment_method NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  receive_number TEXT,
  instructions TEXT,
  min_deposit NUMERIC(12,2) NOT NULL DEFAULT 50,
  max_deposit NUMERIC(12,2) NOT NULL DEFAULT 25000,
  min_withdraw NUMERIC(12,2) NOT NULL DEFAULT 100,
  max_withdraw NUMERIC(12,2) NOT NULL DEFAULT 25000,
  deposit_enabled BOOLEAN NOT NULL DEFAULT true,
  withdraw_enabled BOOLEAN NOT NULL DEFAULT true,
  icon TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can read payment settings"
  ON public.payment_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage payment settings"
  ON public.payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_settings_touch
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default payment methods
INSERT INTO public.payment_settings (method, display_name, receive_number, instructions, icon, color, sort_order)
VALUES
  ('bkash', 'bKash', '01700000000', 'Send Money অপশনে গিয়ে নাম্বারে টাকা পাঠান, তারপর ট্রানজেকশন আইডি দিন।', '📱', '#E2136E', 1),
  ('nagad', 'Nagad',  '01800000000', 'Send Money অপশনে গিয়ে নাম্বারে টাকা পাঠান, তারপর ট্রানজেকশন আইডি দিন।', '💸', '#F37A20', 2),
  ('rocket','Rocket', '017000000001','Send Money অপশনে গিয়ে নাম্বারে টাকা পাঠান, তারপর ট্রানজেকশন আইডি দিন।', '🚀', '#8C3494', 3),
  ('bank',  'Bank Transfer', NULL, 'A/C: 1234567890, Bank Asia, Dhaka — ব্রাঞ্চ যেকোনো।', '🏦', '#1E3A8A', 4);
