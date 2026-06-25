CREATE OR REPLACE FUNCTION public.auto_advance_bot_matches(_tid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_m record;
  v_winner uuid;
  v_resolved int := 0;
  v_loops int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Loop because each report_match_winner call may create new pending matches in the next round
  LOOP
    v_loops := v_loops + 1;
    IF v_loops > 50 THEN EXIT; END IF;

    SELECT m.* INTO v_m
    FROM public.tournament_matches m
    JOIN public.profiles p1 ON p1.id = m.player1_id
    JOIN public.profiles p2 ON p2.id = m.player2_id
    WHERE m.tournament_id = _tid
      AND m.status = 'pending'
      AND m.player1_id IS NOT NULL
      AND m.player2_id IS NOT NULL
      AND p1.is_bot = true
      AND p2.is_bot = true
    ORDER BY m.round, m.match_no
    LIMIT 1;

    IF NOT FOUND THEN EXIT; END IF;

    -- Pick random winner
    IF random() < 0.5 THEN
      v_winner := v_m.player1_id;
    ELSE
      v_winner := v_m.player2_id;
    END IF;

    -- Inline finish (cannot reuse report_match_winner because of auth-check on player membership)
    UPDATE public.tournament_matches
      SET winner_id = v_winner, status = 'finished', updated_at = now()
      WHERE id = v_m.id;
    v_resolved := v_resolved + 1;

    -- If round complete, build next round (mirror logic from report_match_winner)
    PERFORM public.advance_tournament_round(_tid, v_m.round);
  END LOOP;

  RETURN jsonb_build_object('resolved', v_resolved, 'loops', v_loops);
END $$;

-- Helper: advance one round (split out so auto_advance_bot_matches can call it without auth-check)
CREATE OR REPLACE FUNCTION public.advance_tournament_round(_tid uuid, _round int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending int;
  v_winners uuid[];
  v_n int;
  v_i int := 1;
  v_match_no int := 1;
  v_t record;
  v_first_prize numeric;
  v_second_prize numeric;
  v_third_prize numeric;
  v_runner_up uuid;
  v_third uuid;
BEGIN
  SELECT count(*) INTO v_pending FROM public.tournament_matches
    WHERE tournament_id = _tid AND round = _round
      AND status NOT IN ('finished', 'bye');
  IF v_pending > 0 THEN RETURN; END IF;

  SELECT array_agg(winner_id ORDER BY match_no) INTO v_winners
    FROM public.tournament_matches
    WHERE tournament_id = _tid AND round = _round AND winner_id IS NOT NULL;
  v_n := COALESCE(array_length(v_winners, 1), 0);

  IF v_n <= 1 THEN
    -- Final winner — distribute prizes
    IF v_n = 1 THEN
      SELECT * INTO v_t FROM public.tournaments WHERE id = _tid FOR UPDATE;
      v_first_prize  := round(v_t.prize_pool * 0.6, 2);
      v_second_prize := round(v_t.prize_pool * 0.25, 2);
      v_third_prize  := round(v_t.prize_pool * 0.15, 2);

      -- 1st (only pay if human)
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_winners[1] AND is_bot = true) THEN
        INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_winners[1], v_first_prize)
          ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
        INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
          VALUES (v_winners[1], 'prize', 'system', v_first_prize, 'approved', now(), 'tournament:' || _tid::text);
      END IF;
      UPDATE public.tournament_entries SET placement = 1, prize_won = v_first_prize
        WHERE tournament_id = _tid AND user_id = v_winners[1];

      -- Runner-up (loser of the final)
      SELECT (CASE WHEN player1_id = winner_id THEN player2_id ELSE player1_id END)
        INTO v_runner_up
        FROM public.tournament_matches
        WHERE tournament_id = _tid AND round = _round AND match_no = 1;
      IF v_runner_up IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_runner_up AND is_bot = true) THEN
          INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_runner_up, v_second_prize)
            ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
          INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
            VALUES (v_runner_up, 'prize', 'system', v_second_prize, 'approved', now(), 'tournament:' || _tid::text);
        END IF;
        UPDATE public.tournament_entries SET placement = 2, prize_won = v_second_prize
          WHERE tournament_id = _tid AND user_id = v_runner_up;
      END IF;

      -- 3rd: loser of semifinal (round - 1, match_no = 1) if exists
      IF _round > 1 THEN
        SELECT (CASE WHEN player1_id = winner_id THEN player2_id ELSE player1_id END)
          INTO v_third
          FROM public.tournament_matches
          WHERE tournament_id = _tid AND round = _round - 1 AND match_no = 1;
        IF v_third IS NOT NULL THEN
          IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_third AND is_bot = true) THEN
            INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_third, v_third_prize)
              ON CONFLICT (user_id) DO UPDATE SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
            INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
              VALUES (v_third, 'prize', 'system', v_third_prize, 'approved', now(), 'tournament:' || _tid::text);
          END IF;
          UPDATE public.tournament_entries SET placement = 3, prize_won = v_third_prize
            WHERE tournament_id = _tid AND user_id = v_third;
        END IF;
      END IF;

      UPDATE public.tournaments SET status = 'finished', updated_at = now() WHERE id = _tid;
    END IF;
    RETURN;
  END IF;

  -- Build next round
  WHILE v_i < v_n LOOP
    INSERT INTO public.tournament_matches (tournament_id, round, match_no, player1_id, player2_id, status)
      VALUES (_tid, _round + 1, v_match_no, v_winners[v_i], v_winners[v_i + 1], 'pending');
    v_match_no := v_match_no + 1;
    v_i := v_i + 2;
  END LOOP;
  -- Odd leftover gets a bye
  IF v_i = v_n THEN
    INSERT INTO public.tournament_matches (tournament_id, round, match_no, player1_id, player2_id, winner_id, status)
      VALUES (_tid, _round + 1, v_match_no, v_winners[v_i], NULL, v_winners[v_i], 'finished');
  END IF;
END $$;