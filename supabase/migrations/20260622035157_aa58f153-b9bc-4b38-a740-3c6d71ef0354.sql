
-- 1. Tighten profiles_update_own: prevent self-elevation of privileged fields
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_verified = (SELECT is_verified FROM public.profiles WHERE id = auth.uid())
    AND is_blocked  = (SELECT is_blocked  FROM public.profiles WHERE id = auth.uid())
    AND level       = (SELECT level       FROM public.profiles WHERE id = auth.uid())
    AND total_wins  = (SELECT total_wins  FROM public.profiles WHERE id = auth.uid())
    AND total_losses= (SELECT total_losses FROM public.profiles WHERE id = auth.uid())
    AND total_games = (SELECT total_games FROM public.profiles WHERE id = auth.uid())
    AND referred_by IS NOT DISTINCT FROM (SELECT referred_by FROM public.profiles WHERE id = auth.uid())
  );

-- 2. Tighten transactions insert: only pending deposit/withdraw with positive amount, no privileged fields
DROP POLICY IF EXISTS tx_insert_own ON public.transactions;
CREATE POLICY tx_insert_own ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND type IN ('deposit','withdraw')
    AND amount > 0
    AND amount <= 1000000
    AND admin_note IS NULL
    AND processed_at IS NULL
  );

-- 3. Hide sensitive credentials in app_settings from clients
DROP POLICY IF EXISTS "App settings are readable" ON public.app_settings;
CREATE POLICY "App settings are readable" ON public.app_settings
  FOR SELECT TO anon, authenticated
  USING (key NOT IN ('twilio','fincra','smtp','sms','payment_secrets'));

-- 4. Restrict game_room_players read to authenticated users
DROP POLICY IF EXISTS grp_read ON public.game_room_players;
CREATE POLICY grp_read ON public.game_room_players
  FOR SELECT TO authenticated
  USING (true);

-- 5. Restrict notifications read to authenticated users
DROP POLICY IF EXISTS notif_own ON public.notifications;
CREATE POLICY notif_own ON public.notifications
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR (user_id IS NULL) OR has_role(auth.uid(), 'admin'::app_role));

-- 6. Remove player self-report of tournament match winners (admin/server only)
CREATE OR REPLACE FUNCTION public.report_match_winner(_match_id uuid, _winner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _m record;
  _next_round int;
  _next_match_no int;
  _slot int;
  _remaining int;
  _t record;
  _final_round int;
  _pool numeric;
  _runner uuid;
BEGIN
  -- Only admins (or trusted server callers) may report results
  IF _uid IS NULL OR NOT public.has_role(_uid,'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;

  SELECT * INTO _m FROM public.tournament_matches WHERE id = _match_id FOR UPDATE;
  IF _m IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _m.status = 'completed' THEN RETURN jsonb_build_object('ok',false,'error','already_done'); END IF;
  IF _winner_id <> _m.player1_id AND _winner_id <> _m.player2_id THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_winner');
  END IF;

  UPDATE public.tournament_matches
  SET winner_id=_winner_id, status='completed'
  WHERE id=_match_id;

  SELECT MAX(round) INTO _final_round FROM public.tournament_matches WHERE tournament_id=_m.tournament_id;

  IF _m.round < _final_round OR EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE tournament_id=_m.tournament_id AND round=_m.round AND match_no <> _m.match_no
  ) THEN
    _next_round := _m.round + 1;
    _next_match_no := CEIL(_m.match_no::numeric / 2)::int;
    _slot := CASE WHEN (_m.match_no % 2) = 1 THEN 1 ELSE 2 END;

    INSERT INTO public.tournament_matches(tournament_id, round, match_no, player1_id, player2_id, status)
    VALUES (_m.tournament_id, _next_round, _next_match_no,
            CASE WHEN _slot=1 THEN _winner_id ELSE NULL END,
            CASE WHEN _slot=2 THEN _winner_id ELSE NULL END,
            'pending')
    ON CONFLICT (tournament_id, round, match_no) DO UPDATE
      SET player1_id = CASE WHEN _slot=1 THEN _winner_id ELSE public.tournament_matches.player1_id END,
          player2_id = CASE WHEN _slot=2 THEN _winner_id ELSE public.tournament_matches.player2_id END;
  END IF;

  SELECT COUNT(*) INTO _remaining
  FROM public.tournament_matches
  WHERE tournament_id=_m.tournament_id AND status NOT IN ('completed','bye');

  IF _remaining = 0 THEN
    SELECT * INTO _t FROM public.tournaments WHERE id=_m.tournament_id;
    _pool := COALESCE(_t.prize_pool, 0);

    SELECT CASE WHEN winner_id=player1_id THEN player2_id ELSE player1_id END
    INTO _runner
    FROM public.tournament_matches
    WHERE tournament_id=_m.tournament_id AND round=_final_round
    LIMIT 1;

    UPDATE public.tournament_entries SET placement=NULL, prize_won=0 WHERE tournament_id=_m.tournament_id;

    UPDATE public.tournament_entries te
    SET placement=1, prize_won = FLOOR(_pool * CASE WHEN (SELECT COUNT(*) FROM public.tournament_entries WHERE tournament_id=_m.tournament_id) >= 3 THEN 0.5 ELSE 1.0 END)
    FROM public.tournament_matches tm
    WHERE tm.tournament_id=_m.tournament_id AND tm.round=_final_round
      AND te.tournament_id=_m.tournament_id AND te.user_id=tm.winner_id;

    IF _runner IS NOT NULL THEN
      UPDATE public.tournament_entries
      SET placement=2,
          prize_won = FLOOR(_pool * CASE WHEN (SELECT COUNT(*) FROM public.tournament_entries WHERE tournament_id=_m.tournament_id) >= 3 THEN 0.3 ELSE 0 END)
      WHERE tournament_id=_m.tournament_id AND user_id=_runner;
    END IF;

    IF _final_round > 1 THEN
      UPDATE public.tournament_entries te
      SET placement=3, prize_won = FLOOR(_pool * 0.2)
      FROM (
        SELECT CASE WHEN winner_id=player1_id THEN player2_id ELSE player1_id END AS loser_id
        FROM public.tournament_matches
        WHERE tournament_id=_m.tournament_id AND round=_final_round-1 AND winner_id IS NOT NULL
        ORDER BY match_no DESC LIMIT 1
      ) s
      WHERE te.tournament_id=_m.tournament_id AND te.user_id=s.loser_id;
    END IF;

    INSERT INTO public.balances(user_id)
    SELECT user_id FROM public.tournament_entries
    WHERE tournament_id=_m.tournament_id AND prize_won > 0
    ON CONFLICT DO NOTHING;

    UPDATE public.balances b
    SET winnings_balance = winnings_balance + te.prize_won
    FROM public.tournament_entries te
    WHERE te.tournament_id=_m.tournament_id AND te.prize_won > 0 AND b.user_id = te.user_id;

    INSERT INTO public.transactions(user_id,type,method,amount,status)
    SELECT user_id, 'tournament_prize','tournament', prize_won, 'completed'
    FROM public.tournament_entries
    WHERE tournament_id=_m.tournament_id AND prize_won > 0;

    UPDATE public.tournaments SET status='completed', end_at=now() WHERE id=_m.tournament_id;
  END IF;

  RETURN jsonb_build_object('ok',true);
END
$function$;

-- 7. Allow users to delete their own KYC docs
CREATE POLICY "Users can delete own kyc docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);
