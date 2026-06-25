-- Admin approves/rejects deposit/withdraw and updates balance
CREATE OR REPLACE FUNCTION public.admin_process_transaction(_txn_id uuid, _action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tx record; _bal numeric; _dep numeric; _win numeric; _need numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;
  IF _action NOT IN ('approve','reject') THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_action');
  END IF;

  SELECT * INTO _tx FROM public.transactions WHERE id=_txn_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _tx.status <> 'pending' THEN
    RETURN jsonb_build_object('ok',false,'error','already_processed');
  END IF;

  IF _action = 'reject' THEN
    UPDATE public.transactions
      SET status='rejected', processed_at=now()
      WHERE id=_txn_id;
    RETURN jsonb_build_object('ok',true,'status','rejected');
  END IF;

  -- approve
  INSERT INTO public.balances(user_id) VALUES (_tx.user_id) ON CONFLICT DO NOTHING;

  IF _tx.type = 'deposit' THEN
    UPDATE public.balances
       SET deposit_balance = deposit_balance + _tx.amount,
           updated_at = now()
     WHERE user_id = _tx.user_id;
  ELSIF _tx.type = 'withdraw' THEN
    SELECT deposit_balance, winnings_balance INTO _dep, _win
      FROM public.balances WHERE user_id=_tx.user_id FOR UPDATE;
    IF COALESCE(_dep,0) + COALESCE(_win,0) < _tx.amount THEN
      RETURN jsonb_build_object('ok',false,'error','insufficient_balance');
    END IF;
    -- deduct from winnings first, then deposit
    IF COALESCE(_win,0) >= _tx.amount THEN
      UPDATE public.balances SET winnings_balance = winnings_balance - _tx.amount, updated_at=now()
       WHERE user_id=_tx.user_id;
    ELSE
      _need := _tx.amount - COALESCE(_win,0);
      UPDATE public.balances
         SET winnings_balance = 0,
             deposit_balance = deposit_balance - _need,
             updated_at = now()
       WHERE user_id=_tx.user_id;
    END IF;
  ELSE
    RETURN jsonb_build_object('ok',false,'error','unsupported_type');
  END IF;

  UPDATE public.transactions
     SET status='approved', processed_at=now()
   WHERE id=_txn_id;

  RETURN jsonb_build_object('ok',true,'status','approved');
END $$;

-- Create paid friend room with fee deduction
CREATE OR REPLACE FUNCTION public.create_friend_room(_mode text, _entry_fee numeric, _max_players integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _bal numeric; _code text; _room_id uuid; _chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _max_players NOT IN (2,4) THEN RETURN jsonb_build_object('ok',false,'error','invalid_players'); END IF;
  IF _entry_fee < 0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_fee'); END IF;

  INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT (deposit_balance + winnings_balance) INTO _bal FROM public.balances WHERE user_id=_uid FOR UPDATE;
  IF COALESCE(_bal,0) < _entry_fee THEN
    RETURN jsonb_build_object('ok',false,'error','insufficient_balance');
  END IF;

  IF _entry_fee > 0 THEN
    UPDATE public.balances
       SET deposit_balance = GREATEST(deposit_balance - _entry_fee, 0),
           winnings_balance = winnings_balance - GREATEST(_entry_fee - deposit_balance, 0),
           updated_at = now()
     WHERE user_id = _uid;
    INSERT INTO public.transactions(user_id,type,method,amount,status)
    VALUES (_uid,'game_entry','game',_entry_fee,'completed');
  END IF;

  _code := '';
  FOR i IN 1..6 LOOP
    _code := _code || substr(_chars, 1 + floor(random()*length(_chars))::int, 1);
  END LOOP;

  INSERT INTO public.game_rooms(code, mode, entry_fee, max_players, current_players, host_id, status, prize_pool, is_private)
  VALUES (_code, _mode, _entry_fee, _max_players, 1, _uid, 'waiting', _entry_fee * _max_players * 0.9, true)
  RETURNING id INTO _room_id;

  INSERT INTO public.game_room_players(room_id, user_id, seat, is_bot)
  VALUES (_room_id, _uid, 0, false);

  RETURN jsonb_build_object('ok',true,'room_id',_room_id,'code',_code);
END $$;

-- Join paid friend room by code with fee deduction
CREATE OR REPLACE FUNCTION public.join_friend_room(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _room record; _bal numeric;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  SELECT * INTO _room FROM public.game_rooms WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _room.status <> 'waiting' THEN RETURN jsonb_build_object('ok',false,'error','not_joinable'); END IF;
  IF _room.current_players >= _room.max_players THEN RETURN jsonb_build_object('ok',false,'error','room_full'); END IF;

  IF EXISTS(SELECT 1 FROM public.game_room_players WHERE room_id=_room.id AND user_id=_uid) THEN
    RETURN jsonb_build_object('ok',true,'room_id',_room.id);
  END IF;

  INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT (deposit_balance + winnings_balance) INTO _bal FROM public.balances WHERE user_id=_uid FOR UPDATE;
  IF COALESCE(_bal,0) < _room.entry_fee THEN
    RETURN jsonb_build_object('ok',false,'error','insufficient_balance');
  END IF;

  IF _room.entry_fee > 0 THEN
    UPDATE public.balances
       SET deposit_balance = GREATEST(deposit_balance - _room.entry_fee, 0),
           winnings_balance = winnings_balance - GREATEST(_room.entry_fee - deposit_balance, 0),
           updated_at = now()
     WHERE user_id = _uid;
    INSERT INTO public.transactions(user_id,type,method,amount,status)
    VALUES (_uid,'game_entry','game',_room.entry_fee,'completed');
  END IF;

  INSERT INTO public.game_room_players(room_id, user_id, seat, is_bot)
  VALUES (_room.id, _uid, _room.current_players, false);

  UPDATE public.game_rooms
     SET current_players = current_players + 1,
         updated_at = now()
   WHERE id = _room.id;

  RETURN jsonb_build_object('ok',true,'room_id',_room.id);
END $$;