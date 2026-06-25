CREATE OR REPLACE FUNCTION public.create_match_with_bots(_mode text, _entry_fee numeric, _players integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
        _room_id uuid;
        _bal numeric;
        i int;
        _bot uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _players NOT IN (2,4) THEN RETURN jsonb_build_object('ok',false,'error','invalid_players'); END IF;
  IF _entry_fee < 0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_fee'); END IF;

  -- Check + deduct entry fee (deposit first, then winnings)
  IF _entry_fee > 0 THEN
    INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
    SELECT (deposit_balance + winnings_balance) INTO _bal FROM public.balances WHERE user_id=_uid FOR UPDATE;
    IF COALESCE(_bal,0) < _entry_fee THEN
      RETURN jsonb_build_object('ok',false,'error','insufficient_balance');
    END IF;
    UPDATE public.balances
       SET deposit_balance = GREATEST(deposit_balance - _entry_fee, 0),
           winnings_balance = winnings_balance - GREATEST(_entry_fee - deposit_balance, 0)
     WHERE user_id = _uid;
    INSERT INTO public.transactions(user_id,type,method,amount,status)
    VALUES (_uid,'game_entry','game',_entry_fee,'completed');
  END IF;

  INSERT INTO public.game_rooms(mode, entry_fee, max_players, current_players, host_id, status, prize_pool)
  VALUES (_mode, _entry_fee, _players, _players, _uid, 'waiting', _entry_fee * _players * 0.9)
  RETURNING id INTO _room_id;

  INSERT INTO public.game_room_players(room_id, user_id, seat, is_bot)
  VALUES (_room_id, _uid, 0, false);

  FOR i IN 1.._players-1 LOOP
    _bot := gen_random_uuid();
    INSERT INTO public.game_room_players(room_id, user_id, seat, is_bot)
    VALUES (_room_id, _bot, i, true);
  END LOOP;

  RETURN jsonb_build_object('ok',true,'room_id',_room_id);
END $$;