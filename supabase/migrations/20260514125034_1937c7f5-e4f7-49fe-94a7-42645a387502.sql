-- 1) Default commission + level-gate settings
INSERT INTO public.app_settings (key, value)
VALUES (
  'game',
  jsonb_build_object(
    'commission_percent', 10,
    'level_gates', jsonb_build_array(
      jsonb_build_object('min_entry', 0,    'min_level', 1),
      jsonb_build_object('min_entry', 100,  'min_level', 2),
      jsonb_build_object('min_entry', 250,  'min_level', 4),
      jsonb_build_object('min_entry', 500,  'min_level', 6)
    )
  )
)
ON CONFLICT (key) DO NOTHING;

-- 2) Level-check helper (called from client before joining a room)
CREATE OR REPLACE FUNCTION public.check_level_gate(_entry_fee numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_level int;
  v_settings jsonb;
  v_required int := 1;
  v_gate jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT level INTO v_level FROM public.profiles WHERE id = v_user;
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'game';
  IF v_settings IS NOT NULL THEN
    FOR v_gate IN SELECT * FROM jsonb_array_elements(v_settings->'level_gates') LOOP
      IF _entry_fee >= (v_gate->>'min_entry')::numeric THEN
        v_required := GREATEST(v_required, (v_gate->>'min_level')::int);
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object(
    'allowed', COALESCE(v_level,1) >= v_required,
    'user_level', COALESCE(v_level,1),
    'required_level', v_required
  );
END $$;

-- 3) Multiplayer game finalize RPC
-- Caller must be the host. Pools entry fees from each non-bot seat,
-- deducts commission, awards prize to winner, updates stats.
CREATE OR REPLACE FUNCTION public.finish_multi_game(_room_id uuid, _winner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_room record;
  v_settings jsonb;
  v_commission_pct numeric;
  v_seat record;
  v_dep numeric;
  v_win numeric;
  v_total_pot numeric := 0;
  v_human_count int := 0;
  v_commission numeric;
  v_prize numeric;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_rooms WHERE id = _room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.host_id <> v_caller THEN RAISE EXCEPTION 'Only host can finalize'; END IF;
  IF v_room.status = 'finished' THEN RAISE EXCEPTION 'Game already finalized'; END IF;

  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'game';
  v_commission_pct := COALESCE((v_settings->>'commission_percent')::numeric, 10);

  -- Charge entry fee from every non-bot seat
  FOR v_seat IN
    SELECT user_id FROM public.game_room_players
    WHERE room_id = _room_id AND is_bot = false
  LOOP
    v_human_count := v_human_count + 1;
    IF v_room.entry_fee > 0 THEN
      SELECT deposit_balance, winnings_balance INTO v_dep, v_win
        FROM public.balances WHERE user_id = v_seat.user_id FOR UPDATE;
      IF (COALESCE(v_dep,0) + COALESCE(v_win,0)) < v_room.entry_fee THEN
        -- Skip players with insufficient funds (don't block finalization)
        CONTINUE;
      END IF;
      IF v_win >= v_room.entry_fee THEN
        UPDATE public.balances
          SET winnings_balance = winnings_balance - v_room.entry_fee, updated_at = now()
          WHERE user_id = v_seat.user_id;
      ELSE
        UPDATE public.balances
          SET winnings_balance = 0,
              deposit_balance  = deposit_balance - (v_room.entry_fee - v_win),
              updated_at = now()
          WHERE user_id = v_seat.user_id;
      END IF;
      INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
        VALUES (v_seat.user_id, 'game_entry', 'system', v_room.entry_fee, 'approved', now(), _room_id::text);
      v_total_pot := v_total_pot + v_room.entry_fee;
    END IF;

    -- Stat updates for every human seat
    UPDATE public.profiles
      SET total_games  = total_games  + 1,
          total_wins   = total_wins   + CASE WHEN id = _winner_user_id THEN 1 ELSE 0 END,
          total_losses = total_losses + CASE WHEN id = _winner_user_id THEN 0 ELSE 1 END,
          updated_at = now()
      WHERE id = v_seat.user_id;
  END LOOP;

  -- Compute commission and prize
  v_commission := round(v_total_pot * v_commission_pct / 100, 2);
  v_prize := v_total_pot - v_commission;

  -- Pay winner
  IF _winner_user_id IS NOT NULL AND v_prize > 0 THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (_winner_user_id, v_prize)
      ON CONFLICT (user_id) DO UPDATE
      SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance,
          updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (_winner_user_id, 'prize', 'system', v_prize, 'approved', now(), _room_id::text);
  END IF;

  -- Mark room finished
  UPDATE public.game_rooms
    SET status = 'finished', ended_at = now(), winner_id = _winner_user_id
    WHERE id = _room_id;

  -- Save game result
  INSERT INTO public.game_results (room_id, mode, entry_fee, prize_awarded, winner_id, player_ids)
    VALUES (
      _room_id::text, v_room.mode, v_room.entry_fee, COALESCE(v_prize,0), _winner_user_id,
      (SELECT array_agg(user_id) FROM public.game_room_players WHERE room_id = _room_id AND is_bot = false)
    );

  RETURN jsonb_build_object(
    'pot', v_total_pot,
    'commission', v_commission,
    'commission_percent', v_commission_pct,
    'prize', v_prize,
    'winner', _winner_user_id,
    'human_players', v_human_count
  );
END $$;