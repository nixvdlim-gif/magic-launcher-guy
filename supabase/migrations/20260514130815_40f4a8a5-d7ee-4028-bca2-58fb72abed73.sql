
-- 1) PHONE COLUMN PROTECTION
-- Revoke broad column access; only grant safe columns to authenticated.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (
  id, username, avatar_url, level, total_wins, total_losses, total_games,
  game_id, is_verified, is_blocked, language, referred_by, created_at, updated_at
) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Secure function: owner-only read of own phone
CREATE OR REPLACE FUNCTION public.get_my_phone()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT phone FROM public.profiles WHERE id = auth.uid() $$;

-- Admin function: read any phone
CREATE OR REPLACE FUNCTION public.admin_get_phone(_uid uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN (SELECT phone FROM public.profiles WHERE id = _uid);
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_phone(uuid) TO authenticated;

-- 2) KYC PRIVATE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Users upload own kyc docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own kyc docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-docs' AND (
  auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')
));

CREATE POLICY "Admins manage kyc docs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'));

-- 3) finish_solo_game: cap prize relative to entry fee
CREATE OR REPLACE FUNCTION public.finish_solo_game(_room_id text, _mode text, _entry_fee numeric, _prize numeric, _won boolean, _duration integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_dep numeric;
  v_win numeric;
  v_max_prize numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _entry_fee < 0 OR _prize < 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  -- Server-side prize cap: max 10x entry fee, or 0 if no entry
  v_max_prize := CASE WHEN _entry_fee > 0 THEN _entry_fee * 10 ELSE 0 END;
  IF _prize > v_max_prize THEN
    RAISE EXCEPTION 'Prize exceeds allowed cap';
  END IF;

  -- Rate-limit: max 1 solo finish per 3 seconds per user
  IF EXISTS (
    SELECT 1 FROM public.game_results
    WHERE auth.uid() = ANY(player_ids)
      AND created_at > now() - interval '3 seconds'
  ) THEN
    RAISE EXCEPTION 'Too fast — wait a moment';
  END IF;

  IF _entry_fee > 0 THEN
    SELECT deposit_balance, winnings_balance INTO v_dep, v_win
      FROM public.balances WHERE user_id = v_user FOR UPDATE;
    IF (COALESCE(v_dep,0) + COALESCE(v_win,0)) < _entry_fee THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    IF v_win >= _entry_fee THEN
      UPDATE public.balances SET winnings_balance = winnings_balance - _entry_fee, updated_at = now()
        WHERE user_id = v_user;
    ELSE
      UPDATE public.balances
        SET winnings_balance = 0,
            deposit_balance = deposit_balance - (_entry_fee - v_win),
            updated_at = now()
        WHERE user_id = v_user;
    END IF;
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_user, 'game_entry', 'system', _entry_fee, 'approved', now(), _room_id);
  END IF;

  IF _won AND _prize > 0 THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, _prize)
      ON CONFLICT (user_id) DO UPDATE
      SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_user, 'prize', 'system', _prize, 'approved', now(), _room_id);
  END IF;

  UPDATE public.profiles
    SET total_games = total_games + 1,
        total_wins = total_wins + CASE WHEN _won THEN 1 ELSE 0 END,
        total_losses = total_losses + CASE WHEN _won THEN 0 ELSE 1 END,
        updated_at = now()
    WHERE id = v_user;

  INSERT INTO public.game_results (room_id, mode, entry_fee, prize_awarded, winner_id, player_ids, duration_seconds)
    VALUES (_room_id, _mode, _entry_fee, CASE WHEN _won THEN _prize ELSE 0 END,
            CASE WHEN _won THEN v_user ELSE NULL END, ARRAY[v_user], _duration);

  RETURN jsonb_build_object('won', _won, 'prize', CASE WHEN _won THEN _prize ELSE 0 END);
END;
$function$;

-- 4) Admin signed URL helper for KYC docs (returns path only; signing happens client-side via supabase.storage.createSignedUrl)
-- No SQL needed; admin uses storage.createSignedUrl.
