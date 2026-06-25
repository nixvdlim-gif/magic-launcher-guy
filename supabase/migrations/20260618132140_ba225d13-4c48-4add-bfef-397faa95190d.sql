CREATE OR REPLACE FUNCTION public.finish_multi_game(_room_id uuid, _winner_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _room record; _player record; _pot numeric; _prize numeric; _uid uuid := auth.uid(); _winner_is_bot boolean;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  SELECT * INTO _room FROM public.game_rooms WHERE id=_room_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;
  IF _room.status = 'completed' THEN RETURN jsonb_build_object('ok',false,'error','already_done'); END IF;
  IF _room.host_id <> _uid AND NOT public.has_role(_uid,'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;
  IF _winner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_room_players WHERE room_id=_room_id AND user_id=_winner_id
  ) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_winner');
  END IF;

  SELECT COALESCE(is_bot,false) INTO _winner_is_bot
    FROM public.game_room_players WHERE room_id=_room_id AND user_id=_winner_id;

  _pot := COALESCE(_room.entry_fee,0) * COALESCE(_room.current_players,0);
  _prize := _pot * 0.9;

  -- Insert results ONLY for real users (bots have random uuids not in auth.users → FK violation)
  FOR _player IN
    SELECT grp.user_id
    FROM public.game_room_players grp
    JOIN auth.users u ON u.id = grp.user_id
    WHERE grp.room_id=_room_id AND COALESCE(grp.is_bot,false)=false
  LOOP
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

  IF _winner_id IS NOT NULL AND NOT COALESCE(_winner_is_bot,false) AND _prize > 0 THEN
    INSERT INTO public.balances(user_id) VALUES (_winner_id) ON CONFLICT DO NOTHING;
    UPDATE public.balances SET winnings_balance = winnings_balance + _prize WHERE user_id = _winner_id;
    INSERT INTO public.transactions(user_id,type,method,amount,status)
    VALUES (_winner_id,'game_win','game',_prize,'completed');
  END IF;
  UPDATE public.game_rooms SET status='completed', ended_at=now() WHERE id=_room_id;
  RETURN jsonb_build_object('ok',true,'prize',_prize);
END $function$;