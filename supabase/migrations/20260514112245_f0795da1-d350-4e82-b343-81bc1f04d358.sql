
-- Balance transfers table
CREATE TABLE IF NOT EXISTS public.balance_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  fee_percent NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  recipient_received NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.balance_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transfers" ON public.balance_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Admins manage transfers" ON public.balance_transfers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Referral earnings table
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  earner_id UUID NOT NULL,
  source_user_id UUID NOT NULL,
  source_deposit_id UUID,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 3),
  deposit_amount NUMERIC NOT NULL,
  commission_percent NUMERIC NOT NULL,
  commission_earned NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referral earnings" ON public.referral_earnings
  FOR SELECT TO authenticated
  USING (auth.uid() = earner_id);
CREATE POLICY "Admins manage referral earnings" ON public.referral_earnings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('transfer', '{"fee_percent": 5, "min_amount": 50, "max_amount": 25000, "enabled": true}'::jsonb),
  ('referral', '{"l1_percent": 5, "l2_percent": 2, "l3_percent": 1, "enabled": true, "min_deposit": 100}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- transfer_balance RPC
CREATE OR REPLACE FUNCTION public.transfer_balance(_recipient_game_id text, _amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_recipient uuid;
  v_settings jsonb;
  v_fee_percent numeric;
  v_min numeric;
  v_max numeric;
  v_enabled boolean;
  v_fee numeric;
  v_received numeric;
  v_winnings numeric;
  v_xfer_id uuid;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'transfer';
  v_fee_percent := COALESCE((v_settings->>'fee_percent')::numeric, 5);
  v_min := COALESCE((v_settings->>'min_amount')::numeric, 50);
  v_max := COALESCE((v_settings->>'max_amount')::numeric, 25000);
  v_enabled := COALESCE((v_settings->>'enabled')::boolean, true);

  IF NOT v_enabled THEN RAISE EXCEPTION 'Transfers disabled'; END IF;
  IF _amount < v_min OR _amount > v_max THEN
    RAISE EXCEPTION 'Amount must be between % and %', v_min, v_max;
  END IF;

  SELECT id INTO v_recipient FROM public.profiles WHERE game_id = _recipient_game_id;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient = v_sender THEN RAISE EXCEPTION 'Cannot transfer to yourself'; END IF;

  v_fee := round(_amount * v_fee_percent / 100, 2);
  v_received := _amount - v_fee;

  SELECT winnings_balance INTO v_winnings FROM public.balances WHERE user_id = v_sender FOR UPDATE;
  IF v_winnings IS NULL OR v_winnings < _amount THEN
    RAISE EXCEPTION 'Insufficient winnings balance';
  END IF;

  -- Debit sender
  UPDATE public.balances SET winnings_balance = winnings_balance - _amount, updated_at = now()
    WHERE user_id = v_sender;
  -- Credit recipient (to winnings — withdrawable)
  INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_recipient, v_received)
    ON CONFLICT (user_id) DO UPDATE
    SET winnings_balance = public.balances.winnings_balance + EXCLUDED.winnings_balance,
        updated_at = now();

  INSERT INTO public.balance_transfers (sender_id, recipient_id, amount, fee_percent, fee_amount, recipient_received)
    VALUES (v_sender, v_recipient, _amount, v_fee_percent, v_fee, v_received)
    RETURNING id INTO v_xfer_id;

  -- Log informational transactions (status approved; trigger ignores transfer_* types)
  INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
    VALUES
      (v_sender, 'transfer_out', 'system', _amount, 'approved', now(), v_xfer_id::text),
      (v_recipient, 'transfer_in', 'system', v_received, 'approved', now(), v_xfer_id::text);

  RETURN jsonb_build_object('transfer_id', v_xfer_id, 'fee', v_fee, 'received', v_received);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_balance(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_balance(text, numeric) TO authenticated;

-- Referral commission trigger function
CREATE OR REPLACE FUNCTION public.process_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_enabled boolean;
  v_min numeric;
  v_pcts numeric[];
  v_current uuid;
  v_referrer uuid;
  v_lvl int;
  v_pct numeric;
  v_amt numeric;
BEGIN
  IF NEW.type <> 'deposit' OR NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

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
      -- credit referrer winnings
      INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_referrer, v_amt)
        ON CONFLICT (user_id) DO UPDATE
        SET winnings_balance = public.balances.winnings_balance + EXCLUDED.winnings_balance,
            updated_at = now();
      INSERT INTO public.referral_earnings (earner_id, source_user_id, source_deposit_id, level, deposit_amount, commission_percent, commission_earned)
        VALUES (v_referrer, NEW.user_id, NEW.id, v_lvl, NEW.amount, v_pct, v_amt);
      INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
        VALUES (v_referrer, 'referral_bonus', 'system', v_amt, 'approved', now(), NEW.id::text);
    END IF;
    v_current := v_referrer;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_referral_bonus_trg ON public.transactions;
CREATE TRIGGER process_referral_bonus_trg
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.process_referral_bonus();

-- Apply referral on signup if referral_code (game_id) provided in metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_code text;
  v_ref_id uuid;
BEGIN
  v_ref_code := NEW.raw_user_meta_data ->> 'referral_code';
  IF v_ref_code IS NOT NULL AND length(v_ref_code) > 0 THEN
    SELECT id INTO v_ref_id FROM public.profiles WHERE game_id = v_ref_code;
  END IF;

  INSERT INTO public.profiles (id, game_id, username, phone, referred_by)
  VALUES (
    NEW.id,
    public.generate_game_id(),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'phone',
    v_ref_id
  );

  INSERT INTO public.balances (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player');
  RETURN NEW;
END;
$$;
