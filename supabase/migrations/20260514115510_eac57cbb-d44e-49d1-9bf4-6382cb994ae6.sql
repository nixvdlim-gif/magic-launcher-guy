CREATE OR REPLACE FUNCTION public.finish_solo_game(
  _room_id text,
  _mode text,
  _entry_fee numeric,
  _prize numeric,
  _won boolean,
  _duration int DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dep numeric;
  v_win numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _entry_fee < 0 OR _prize < 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  -- Deduct entry fee (winnings first, then deposit)
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

  -- Credit prize if won
  IF _won AND _prize > 0 THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_user, _prize)
      ON CONFLICT (user_id) DO UPDATE
      SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_user, 'prize', 'system', _prize, 'approved', now(), _room_id);
  END IF;

  -- Update profile stats
  UPDATE public.profiles
    SET total_games = total_games + 1,
        total_wins = total_wins + CASE WHEN _won THEN 1 ELSE 0 END,
        total_losses = total_losses + CASE WHEN _won THEN 0 ELSE 1 END,
        updated_at = now()
    WHERE id = v_user;

  -- Save game result
  INSERT INTO public.game_results (room_id, mode, entry_fee, prize_awarded, winner_id, player_ids, duration_seconds)
    VALUES (_room_id, _mode, _entry_fee, CASE WHEN _won THEN _prize ELSE 0 END,
            CASE WHEN _won THEN v_user ELSE NULL END, ARRAY[v_user], _duration);

  RETURN jsonb_build_object('won', _won, 'prize', CASE WHEN _won THEN _prize ELSE 0 END);
END;
$$;