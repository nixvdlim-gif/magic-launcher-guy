CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  round int NOT NULL,
  match_no int NOT NULL,
  player1_id uuid,
  player2_id uuid,
  winner_id uuid,
  status text NOT NULL DEFAULT 'pending', -- pending, playing, finished, bye
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, round, match_no)
);
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view matches" ON public.tournament_matches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage matches" ON public.tournament_matches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_tm_tournament ON public.tournament_matches(tournament_id, round);

-- Start tournament: shuffle entries into round-1 matches
CREATE OR REPLACE FUNCTION public.start_tournament(_tid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t record;
  v_players uuid[];
  v_n int;
  v_i int := 1;
  v_match_no int := 1;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO v_t FROM public.tournaments WHERE id = _tid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF v_t.status <> 'upcoming' THEN RAISE EXCEPTION 'Tournament already started'; END IF;

  SELECT array_agg(user_id ORDER BY random()) INTO v_players
    FROM public.tournament_entries WHERE tournament_id = _tid;
  v_n := COALESCE(array_length(v_players, 1), 0);
  IF v_n < 2 THEN RAISE EXCEPTION 'Need at least 2 players'; END IF;

  -- Pair players. Last odd player gets a bye.
  WHILE v_i <= v_n LOOP
    IF v_i + 1 <= v_n THEN
      INSERT INTO public.tournament_matches (tournament_id, round, match_no, player1_id, player2_id, status)
        VALUES (_tid, 1, v_match_no, v_players[v_i], v_players[v_i + 1], 'pending');
      v_i := v_i + 2;
    ELSE
      -- Bye: player auto-advances
      INSERT INTO public.tournament_matches (tournament_id, round, match_no, player1_id, winner_id, status)
        VALUES (_tid, 1, v_match_no, v_players[v_i], v_players[v_i], 'bye');
      v_i := v_i + 1;
    END IF;
    v_match_no := v_match_no + 1;
  END LOOP;

  UPDATE public.tournaments SET status = 'live', updated_at = now() WHERE id = _tid;
  RETURN jsonb_build_object('round', 1, 'matches', v_match_no - 1, 'players', v_n);
END $$;

-- Report winner; auto-create next round when current round done; finalize prize when only 1 left
CREATE OR REPLACE FUNCTION public.report_match_winner(_match_id uuid, _winner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m record;
  v_pending int;
  v_winners uuid[];
  v_i int := 1;
  v_match_no int := 1;
  v_next_round int;
  v_n int;
  v_t record;
  v_first_prize numeric;
  v_second_prize numeric;
  v_third_prize numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_m FROM public.tournament_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_m.status = 'finished' THEN RAISE EXCEPTION 'Already finished'; END IF;
  IF _winner_id NOT IN (v_m.player1_id, v_m.player2_id) THEN
    RAISE EXCEPTION 'Winner must be a player in match';
  END IF;
  -- Only admin or one of the players can report
  IF NOT public.has_role(auth.uid(), 'admin')
     AND auth.uid() NOT IN (v_m.player1_id, v_m.player2_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.tournament_matches
    SET winner_id = _winner_id, status = 'finished', updated_at = now()
    WHERE id = _match_id;

  -- Are there any pending matches in this round?
  SELECT count(*) INTO v_pending FROM public.tournament_matches
    WHERE tournament_id = v_m.tournament_id AND round = v_m.round
      AND status NOT IN ('finished', 'bye');
  IF v_pending > 0 THEN
    RETURN jsonb_build_object('done_round', false, 'pending', v_pending);
  END IF;

  -- Round complete: collect winners
  SELECT array_agg(winner_id ORDER BY match_no) INTO v_winners
    FROM public.tournament_matches
    WHERE tournament_id = v_m.tournament_id AND round = v_m.round;
  v_n := COALESCE(array_length(v_winners, 1), 0);

  IF v_n = 1 THEN
    -- Final winner — distribute prize pool
    SELECT * INTO v_t FROM public.tournaments WHERE id = v_m.tournament_id FOR UPDATE;
    v_first_prize  := round(v_t.prize_pool * 0.6, 2);
    v_second_prize := round(v_t.prize_pool * 0.25, 2);
    v_third_prize  := round(v_t.prize_pool * 0.15, 2);

    -- Pay 1st
    INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_winners[1], v_first_prize)
      ON CONFLICT (user_id) DO UPDATE
      SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_winners[1], 'prize', 'system', v_first_prize, 'approved', now(), 'tournament:' || v_t.id::text);
    UPDATE public.tournament_entries SET placement = 1, prize_won = v_first_prize
      WHERE tournament_id = v_t.id AND user_id = v_winners[1];

    -- Pay 2nd & 3rd from semifinal losers (if exist)
    DECLARE v_runner_up uuid; v_third uuid;
    BEGIN
      SELECT (CASE WHEN player1_id = winner_id THEN player2_id ELSE player1_id END)
        INTO v_runner_up
        FROM public.tournament_matches
        WHERE tournament_id = v_t.id AND round = v_m.round AND match_no = 1;
      IF v_runner_up IS NOT NULL THEN
        INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_runner_up, v_second_prize)
          ON CONFLICT (user_id) DO UPDATE
          SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
        INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
          VALUES (v_runner_up, 'prize', 'system', v_second_prize, 'approved', now(), 'tournament:' || v_t.id::text);
        UPDATE public.tournament_entries SET placement = 2, prize_won = v_second_prize
          WHERE tournament_id = v_t.id AND user_id = v_runner_up;
      END IF;

      -- 3rd from previous round losers (semifinal losers)
      IF v_m.round >= 2 THEN
        SELECT (CASE WHEN player1_id = winner_id THEN player2_id ELSE player1_id END)
          INTO v_third
          FROM public.tournament_matches
          WHERE tournament_id = v_t.id AND round = v_m.round - 1
          ORDER BY random() LIMIT 1;
        IF v_third IS NOT NULL THEN
          INSERT INTO public.balances (user_id, winnings_balance) VALUES (v_third, v_third_prize)
            ON CONFLICT (user_id) DO UPDATE
            SET winnings_balance = balances.winnings_balance + EXCLUDED.winnings_balance, updated_at = now();
          INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
            VALUES (v_third, 'prize', 'system', v_third_prize, 'approved', now(), 'tournament:' || v_t.id::text);
          UPDATE public.tournament_entries SET placement = 3, prize_won = v_third_prize
            WHERE tournament_id = v_t.id AND user_id = v_third;
        END IF;
      END IF;
    END;

    UPDATE public.tournaments SET status = 'finished', updated_at = now() WHERE id = v_t.id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (v_winners[1], 'system', '🏆 Tournament won!',
              'You won ৳' || v_first_prize || ' in ' || v_t.name, '/tournaments/' || v_t.id);

    RETURN jsonb_build_object('finished', true, 'champion', v_winners[1], 'prize', v_first_prize);
  END IF;

  -- Build next round
  v_next_round := v_m.round + 1;
  WHILE v_i <= v_n LOOP
    IF v_i + 1 <= v_n THEN
      INSERT INTO public.tournament_matches (tournament_id, round, match_no, player1_id, player2_id, status)
        VALUES (v_m.tournament_id, v_next_round, v_match_no, v_winners[v_i], v_winners[v_i + 1], 'pending');
      v_i := v_i + 2;
    ELSE
      INSERT INTO public.tournament_matches (tournament_id, round, match_no, player1_id, winner_id, status)
        VALUES (v_m.tournament_id, v_next_round, v_match_no, v_winners[v_i], v_winners[v_i], 'bye');
      v_i := v_i + 1;
    END IF;
    v_match_no := v_match_no + 1;
  END LOOP;

  RETURN jsonb_build_object('done_round', true, 'next_round', v_next_round, 'matches', v_match_no - 1);
END $$;