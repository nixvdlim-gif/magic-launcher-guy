
-- Game state for ludo board
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS state jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS current_turn integer NOT NULL DEFAULT 0;

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- KYC submissions
CREATE TYPE public.kyc_status AS ENUM ('pending','approved','rejected');
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type text NOT NULL,
  doc_number text NOT NULL,
  doc_image_url text,
  selfie_url text,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own kyc" ON public.kyc_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users submit kyc" ON public.kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins manage kyc" ON public.kyc_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_kyc_touch BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Daily login bonus
CREATE TABLE public.daily_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  claimed_on date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  day_streak integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claimed_on)
);
ALTER TABLE public.daily_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bonuses" ON public.daily_bonuses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage bonuses" ON public.daily_bonuses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Spin wheel
CREATE TABLE public.spin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_amount numeric NOT NULL,
  reward_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own spins" ON public.spin_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage spins" ON public.spin_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Coupons
CREATE TYPE public.coupon_type AS ENUM ('cash','deposit_bonus','spin');
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type public.coupon_type NOT NULL DEFAULT 'cash',
  amount numeric NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_coupons_touch BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage redemptions" ON public.coupon_redemptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Daily bonus claim function
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_yesterday record;
  v_streak int := 1;
  v_amount numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.daily_bonuses WHERE user_id = v_user AND claimed_on = CURRENT_DATE) THEN
    RAISE EXCEPTION 'Already claimed today';
  END IF;
  SELECT day_streak INTO v_yesterday FROM public.daily_bonuses
    WHERE user_id = v_user AND claimed_on = CURRENT_DATE - 1;
  IF FOUND THEN v_streak := LEAST(v_yesterday.day_streak + 1, 7); END IF;
  v_amount := CASE v_streak
    WHEN 1 THEN 5 WHEN 2 THEN 10 WHEN 3 THEN 15 WHEN 4 THEN 20
    WHEN 5 THEN 30 WHEN 6 THEN 50 ELSE 100 END;
  INSERT INTO public.daily_bonuses (user_id, amount, day_streak) VALUES (v_user, v_amount, v_streak);
  INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
  INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at)
    VALUES (v_user, 'bonus', 'system', v_amount, 'approved', now());
  RETURN jsonb_build_object('amount', v_amount, 'streak', v_streak);
END;
$$;

-- Coupon redeem function
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_c record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_c FROM public.coupons WHERE code = _code AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid coupon'; END IF;
  IF v_c.valid_until IS NOT NULL AND v_c.valid_until < now() THEN RAISE EXCEPTION 'Coupon expired'; END IF;
  IF v_c.used_count >= v_c.max_uses THEN RAISE EXCEPTION 'Coupon limit reached'; END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = v_c.id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Already redeemed';
  END IF;
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, amount) VALUES (v_c.id, v_user, v_c.amount);
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_c.id;
  IF v_c.type = 'cash' THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, v_c.amount)
      ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
  ELSIF v_c.type = 'deposit_bonus' THEN
    INSERT INTO public.balances (user_id, deposit_balance) VALUES (v_user, v_c.amount)
      ON CONFLICT (user_id) DO UPDATE SET deposit_balance = balances.deposit_balance + EXCLUDED.deposit_balance, updated_at = now();
  END IF;
  INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
    VALUES (v_user, 'bonus', 'system', v_c.amount, 'approved', now(), v_c.code);
  RETURN jsonb_build_object('amount', v_c.amount, 'type', v_c.type);
END;
$$;

-- Spin function
CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today_count int;
  v_rolls numeric[] := ARRAY[1,2,5,10,20,50,0,5];
  v_amount numeric;
  v_label text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT count(*) INTO v_today_count FROM public.spin_history
    WHERE user_id = v_user AND created_at > CURRENT_DATE;
  IF v_today_count >= 1 THEN RAISE EXCEPTION 'Daily spin already used'; END IF;
  v_amount := v_rolls[1 + floor(random() * array_length(v_rolls,1))::int];
  v_label := CASE WHEN v_amount = 0 THEN 'Try again' ELSE '৳' || v_amount END;
  INSERT INTO public.spin_history (user_id, reward_amount, reward_label) VALUES (v_user, v_amount, v_label);
  IF v_amount > 0 THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, v_amount)
      ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at)
      VALUES (v_user, 'bonus', 'system', v_amount, 'approved', now());
  END IF;
  RETURN jsonb_build_object('amount', v_amount, 'label', v_label);
END;
$$;
