
-- 1) finish_multi_game: require caller to be the room host
CREATE OR REPLACE FUNCTION public.finish_multi_game(_room_id uuid, _winner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _room record; _player record; _pot numeric; _prize numeric; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  SELECT * INTO _room FROM public.game_rooms WHERE id=_room_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;
  IF _room.status = 'completed' THEN RETURN jsonb_build_object('ok',false,'error','already_done'); END IF;
  IF _room.host_id <> _uid AND NOT public.has_role(_uid,'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;
  -- Winner must be seated in the room (or null = no winner)
  IF _winner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_room_players WHERE room_id=_room_id AND user_id=_winner_id
  ) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_winner');
  END IF;
  _pot := COALESCE(_room.entry_fee,0) * COALESCE(_room.current_players,0);
  _prize := _pot * 0.9;
  FOR _player IN SELECT user_id FROM public.game_room_players WHERE room_id=_room_id AND user_id IS NOT NULL LOOP
    INSERT INTO public.game_results(room_id, user_id, mode, entry_fee, prize_awarded, is_winner)
    VALUES (_room_id, _player.user_id, _room.mode, _room.entry_fee,
            CASE WHEN _player.user_id = _winner_id THEN _prize ELSE 0 END,
            _player.user_id = _winner_id);
    UPDATE public.profiles SET
      total_games = total_games + 1,
      total_wins = total_wins + CASE WHEN _player.user_id = _winner_id THEN 1 ELSE 0 END,
      total_losses = total_losses + CASE WHEN _player.user_id = _winner_id THEN 0 ELSE 1 END
    WHERE id = _player.user_id;
  END LOOP;
  IF _winner_id IS NOT NULL AND _prize > 0 THEN
    INSERT INTO public.balances(user_id) VALUES (_winner_id) ON CONFLICT DO NOTHING;
    UPDATE public.balances SET winnings_balance = winnings_balance + _prize WHERE user_id = _winner_id;
  END IF;
  UPDATE public.game_rooms SET status='completed', ended_at=now() WHERE id=_room_id;
  RETURN jsonb_build_object('ok',true,'prize',_prize);
END $function$;

-- 2) finish_solo_game: read entry_fee/prize from room; require caller = room host
CREATE OR REPLACE FUNCTION public.finish_solo_game(_room_id uuid, _won boolean, _entry_fee numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _room record; _entry numeric := 0; _prize numeric := 0;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  SELECT * INTO _room FROM public.game_rooms WHERE id=_room_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;
  IF _room.status = 'completed' THEN RETURN jsonb_build_object('ok',false,'error','already_done'); END IF;
  IF _room.host_id <> _uid THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;
  -- Use server-stored entry fee, NOT the client-supplied one. Cap prize at entry_fee * 2.
  _entry := COALESCE(_room.entry_fee, 0);
  IF _won THEN _prize := _entry * 2; END IF;

  INSERT INTO public.game_results(room_id, user_id, mode, entry_fee, prize_awarded, is_winner)
  VALUES (_room_id, _uid, COALESCE(_room.mode,'solo'), _entry, _prize, _won);
  UPDATE public.profiles SET
    total_games = total_games + 1,
    total_wins = total_wins + CASE WHEN _won THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN _won THEN 0 ELSE 1 END
  WHERE id = _uid;
  IF _prize > 0 THEN
    INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
    UPDATE public.balances SET winnings_balance = winnings_balance + _prize WHERE user_id=_uid;
  END IF;
  UPDATE public.game_rooms SET status='completed', ended_at=now() WHERE id=_room_id;
  RETURN jsonb_build_object('ok',true,'prize',_prize);
END $function$;

-- Overload to keep the frontend's named-arg call (with _mode/_prize/_duration) compatible
CREATE OR REPLACE FUNCTION public.finish_solo_game(
  _room_id uuid, _mode text, _entry_fee numeric, _prize numeric, _won boolean, _duration integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delegate to the canonical, server-validated implementation. _mode/_prize/_duration are advisory only.
  RETURN public.finish_solo_game(_room_id, _won, _entry_fee);
END $function$;

-- 3) spin_wheel: re-add one-spin-per-day limit
CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _amounts numeric[] := ARRAY[1,2,5,10,20,50]; _amt numeric; _label text; _today_count int;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  SELECT count(*) INTO _today_count FROM public.spin_history
    WHERE user_id = _uid AND created_at >= CURRENT_DATE;
  IF _today_count >= 1 THEN
    RETURN jsonb_build_object('ok',false,'error','already_spun');
  END IF;
  _amt := _amounts[1 + floor(random()*array_length(_amounts,1))::int];
  _label := '৳' || _amt::text;
  INSERT INTO public.spin_history(user_id, reward_label, reward_amount) VALUES (_uid, _label, _amt);
  INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  UPDATE public.balances SET winnings_balance = winnings_balance + _amt WHERE user_id=_uid;
  RETURN jsonb_build_object('ok',true,'amount',_amt,'label',_label);
END $function$;

-- 4) Revoke direct INSERT on tables that must only be written by SECURITY DEFINER RPCs
DROP POLICY IF EXISTS db_insert_own ON public.daily_bonuses;
DROP POLICY IF EXISTS sh_insert_own ON public.spin_history;

-- 5) Revoke EXECUTE on these SECURITY DEFINER functions from anon (only authenticated callers)
REVOKE EXECUTE ON FUNCTION public.finish_multi_game(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.finish_solo_game(uuid, boolean, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.finish_solo_game(uuid, text, numeric, numeric, boolean, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spin_wheel() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_daily_bonus() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.report_match_winner(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finish_multi_game(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_solo_game(uuid, boolean, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_solo_game(uuid, text, numeric, numeric, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_match_winner(uuid, uuid) TO authenticated;
