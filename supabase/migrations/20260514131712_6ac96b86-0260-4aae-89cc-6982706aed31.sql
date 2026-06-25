-- Commission ledger
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  mode text NOT NULL,
  pot_amount numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  player_count int NOT NULL DEFAULT 0,
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view commission" ON public.commission_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_commission_created ON public.commission_ledger(created_at DESC);

-- Refund table for cancelled rooms
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL DEFAULT 'room_cancelled',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view refunds" ON public.refunds FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own refunds" ON public.refunds FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Refund a cancelled room: gives entry_fee back to every human player who paid
CREATE OR REPLACE FUNCTION public.refund_room(_room_id uuid, _reason text DEFAULT 'room_cancelled')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_room record;
  v_seat record;
  v_total_refunded numeric := 0;
  v_count int := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_room FROM public.game_rooms WHERE id = _room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;

  -- Only host or admin can refund
  IF v_room.host_id <> v_caller AND NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_room.status = 'finished' THEN RAISE EXCEPTION 'Cannot refund finished game'; END IF;

  -- Refund every human player who has a paid entry transaction for this room
  FOR v_seat IN
    SELECT DISTINCT grp.user_id
    FROM public.game_room_players grp
    WHERE grp.room_id = _room_id AND grp.is_bot = false
  LOOP
    -- Check if they actually paid (game_entry transaction with this room ref)
    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = v_seat.user_id
        AND type = 'game_entry'
        AND reference = _room_id::text
        AND status = 'approved'
    ) THEN
      -- Refund to deposit_balance
      INSERT INTO public.balances (user_id, deposit_balance) VALUES (v_seat.user_id, v_room.entry_fee)
        ON CONFLICT (user_id) DO UPDATE
        SET deposit_balance = balances.deposit_balance + EXCLUDED.deposit_balance,
            updated_at = now();

      INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference, admin_note)
        VALUES (v_seat.user_id, 'bonus', 'system', v_room.entry_fee, 'approved', now(),
                _room_id::text, 'Refund: ' || _reason);

      INSERT INTO public.refunds (room_id, user_id, amount, reason)
        VALUES (_room_id, v_seat.user_id, v_room.entry_fee, _reason);

      INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (v_seat.user_id, 'system', 'Refund ৳' || v_room.entry_fee,
                'Game cancelled — entry fee returned', '/transactions');

      v_total_refunded := v_total_refunded + v_room.entry_fee;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  UPDATE public.game_rooms SET status = 'cancelled', ended_at = now() WHERE id = _room_id;

  RETURN jsonb_build_object('refunded_count', v_count, 'total', v_total_refunded);
END $$;

-- Update finish_multi_game to record commission in ledger
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

  FOR v_seat IN
    SELECT user_id FROM public.game_room_players
    WHERE room_id = _room_id AND is_bot = false
  LOOP
    v_human_count := v_human_count + 1;
    IF v_room.entry_fee > 0 THEN
      SELECT deposit_balance, winnings_balance INTO v_dep, v_win
        FROM public.balances WHERE user_id = v_seat.user_id FOR UPDATE;
      IF (COALESCE(v_dep,0) + COALESCE(v_win,0)) < v_room.entry_fee THEN
        CONTINUE;
      END IF;
      IF v_win >= v_room.entry_fee THEN
        UPDATE public.balances SET winnings_balance = winnings_balance - v_room.entry_fee, updated_at = now()
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

    UPDATE public.profiles
      SET total_games  = total_games  + 1,
          total_wins   = total_wins   + CASE WHEN id = _winner_user_id THEN 1 ELSE 0 END,
          total_losses = total_losses + CASE WHEN id = _winner_user_id THEN 0 ELSE 1 END,
          updated_at = now()
      WHERE id = v_seat.user_id;
  END LOOP;

  v_commission := round(v_total_pot * v_commission_pct / 100, 2);
  v_prize := v_total_pot - v_commission;

  IF _winner_user_id IS NOT NULL AND v_prize > 0 THEN
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (_winner_user_id, v_prize)
      ON CONFLICT (user_id) DO UPDATE
      SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance,
          updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (_winner_user_id, 'prize', 'system', v_prize, 'approved', now(), _room_id::text);
  END IF;

  -- Record commission in ledger
  IF v_commission > 0 THEN
    INSERT INTO public.commission_ledger (room_id, mode, pot_amount, commission_percent, commission_amount, player_count, winner_id)
      VALUES (_room_id::text, v_room.mode, v_total_pot, v_commission_pct, v_commission, v_human_count, _winner_user_id);
  END IF;

  UPDATE public.game_rooms
    SET status = 'finished', ended_at = now(), winner_id = _winner_user_id
    WHERE id = _room_id;

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