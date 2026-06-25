
-- Real bracket logic for tournaments
-- 1) start_tournament: shuffle entries, build round-1 pairs, auto-advance BYEs
-- 2) report_match_winner: advance winner to next round, set placements+prizes on final
-- 3) auto_start_due_tournaments: cron-driven auto start when start_at passes

CREATE OR REPLACE FUNCTION public.start_tournament(_tid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _t record;
  _entry_count int;
  _is_admin boolean := false;
  _is_player boolean := false;
  _bracket_size int;
  _round1_matches int;
  _player_ids uuid[];
  i int;
  _p1 uuid;
  _p2 uuid;
  _existing int;
BEGIN
  SELECT * INTO _t FROM public.tournaments WHERE id = _tid FOR UPDATE;
  IF _t IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _t.status <> 'upcoming' THEN RETURN jsonb_build_object('ok',false,'error','already_started'); END IF;

  SELECT COUNT(*) INTO _entry_count FROM public.tournament_entries WHERE tournament_id = _tid;
  IF _entry_count < 2 THEN RETURN jsonb_build_object('ok',false,'error','not_enough_players'); END IF;

  IF _uid IS NOT NULL THEN
    _is_admin := public.has_role(_uid,'admin');
    SELECT EXISTS(SELECT 1 FROM public.tournament_entries WHERE tournament_id=_tid AND user_id=_uid) INTO _is_player;
  END IF;

  -- Permission: admin, OR full, OR start time reached, OR any joined player (manual start)
  IF NOT (_is_admin OR _entry_count >= _t.max_players OR now() >= _t.start_at OR _is_player) THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;

  -- Bracket size = smallest power of 2 >= entries (min 2)
  _bracket_size := 2;
  WHILE _bracket_size < _entry_count LOOP _bracket_size := _bracket_size * 2; END LOOP;
  _round1_matches := _bracket_size / 2;

  -- Shuffle entries
  SELECT array_agg(user_id ORDER BY random()) INTO _player_ids
  FROM public.tournament_entries WHERE tournament_id = _tid;

  -- Clear any prior matches (safety)
  DELETE FROM public.tournament_matches WHERE tournament_id = _tid;

  -- Create round 1 matches (pair players; missing slot = BYE auto-advance)
  FOR i IN 1.._round1_matches LOOP
    _p1 := _player_ids[(i-1)*2 + 1];
    _p2 := _player_ids[(i-1)*2 + 2];
    INSERT INTO public.tournament_matches(tournament_id, round, match_no, player1_id, player2_id, status, winner_id)
    VALUES (
      _tid, 1, i, _p1, _p2,
      CASE WHEN _p2 IS NULL THEN 'bye' ELSE 'pending' END,
      CASE WHEN _p2 IS NULL THEN _p1 ELSE NULL END
    );
  END LOOP;

  UPDATE public.tournaments SET status='live', start_at = LEAST(start_at, now()) WHERE id = _tid;

  -- Propagate BYE winners into round 2
  PERFORM public.advance_bye_winners(_tid);

  RETURN jsonb_build_object('ok',true,'bracket_size',_bracket_size,'round1_matches',_round1_matches);
END
$function$;

-- Helper: place a winner into the next round's match slot
CREATE OR REPLACE FUNCTION public.advance_bye_winners(_tid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m record;
  _next_round int;
  _next_match_no int;
  _slot int; -- 1 or 2
BEGIN
  FOR m IN
    SELECT * FROM public.tournament_matches
    WHERE tournament_id=_tid AND status='bye' AND winner_id IS NOT NULL
    ORDER BY round, match_no
  LOOP
    _next_round := m.round + 1;
    _next_match_no := CEIL(m.match_no::numeric / 2)::int;
    _slot := CASE WHEN (m.match_no % 2) = 1 THEN 1 ELSE 2 END;

    -- ensure a next-round match exists only if there is one (bracket may end here)
    IF EXISTS (
      SELECT 1 FROM public.tournament_matches
      WHERE tournament_id=_tid AND round=m.round AND match_no <> m.match_no
    ) OR (SELECT MAX(round) FROM public.tournament_matches WHERE tournament_id=_tid) > m.round THEN
      INSERT INTO public.tournament_matches(tournament_id, round, match_no, player1_id, player2_id, status)
      VALUES (_tid, _next_round, _next_match_no,
              CASE WHEN _slot=1 THEN m.winner_id ELSE NULL END,
              CASE WHEN _slot=2 THEN m.winner_id ELSE NULL END,
              'pending')
      ON CONFLICT DO NOTHING;

      UPDATE public.tournament_matches
      SET player1_id = CASE WHEN _slot=1 THEN m.winner_id ELSE player1_id END,
          player2_id = CASE WHEN _slot=2 THEN m.winner_id ELSE player2_id END
      WHERE tournament_id=_tid AND round=_next_round AND match_no=_next_match_no;
    END IF;
  END LOOP;
END
$$;

-- Unique index so ON CONFLICT works for (tournament_id,round,match_no)
CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_unique_round
  ON public.tournament_matches(tournament_id, round, match_no);

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
  _is_admin boolean := false;
  _pool numeric;
  _r1 numeric; _r2 numeric; _r3 numeric;
  _runner uuid;
BEGIN
  SELECT * INTO _m FROM public.tournament_matches WHERE id = _match_id FOR UPDATE;
  IF _m IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _m.status = 'completed' THEN RETURN jsonb_build_object('ok',false,'error','already_done'); END IF;
  IF _winner_id <> _m.player1_id AND _winner_id <> _m.player2_id THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_winner');
  END IF;

  IF _uid IS NOT NULL THEN _is_admin := public.has_role(_uid,'admin'); END IF;
  IF NOT (_is_admin OR _uid = _m.player1_id OR _uid = _m.player2_id) THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;

  UPDATE public.tournament_matches
  SET winner_id=_winner_id, status='completed'
  WHERE id=_match_id;

  -- Determine if this is the final round
  SELECT MAX(round) INTO _final_round FROM public.tournament_matches WHERE tournament_id=_m.tournament_id;

  IF _m.round < _final_round OR EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE tournament_id=_m.tournament_id AND round=_m.round AND match_no <> _m.match_no
  ) THEN
    -- Advance into next round
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

  -- Are all matches done?
  SELECT COUNT(*) INTO _remaining
  FROM public.tournament_matches
  WHERE tournament_id=_m.tournament_id AND status NOT IN ('completed','bye');

  IF _remaining = 0 THEN
    -- Tournament complete: assign placements + prizes
    SELECT * INTO _t FROM public.tournaments WHERE id=_m.tournament_id;
    _pool := COALESCE(_t.prize_pool, 0);

    -- Winner = winner of final
    -- Runner-up = loser of final
    -- 3rd = loser of any semi (pick highest match_no)
    SELECT CASE WHEN winner_id=player1_id THEN player2_id ELSE player1_id END
    INTO _runner
    FROM public.tournament_matches
    WHERE tournament_id=_m.tournament_id AND round=_final_round
    LIMIT 1;

    -- Reset placements
    UPDATE public.tournament_entries SET placement=NULL, prize_won=0 WHERE tournament_id=_m.tournament_id;

    -- 1st place
    UPDATE public.tournament_entries te
    SET placement=1, prize_won = FLOOR(_pool * CASE WHEN (SELECT COUNT(*) FROM public.tournament_entries WHERE tournament_id=_m.tournament_id) >= 3 THEN 0.5 ELSE 1.0 END)
    FROM public.tournament_matches tm
    WHERE tm.tournament_id=_m.tournament_id AND tm.round=_final_round
      AND te.tournament_id=_m.tournament_id AND te.user_id=tm.winner_id;

    -- 2nd place
    IF _runner IS NOT NULL THEN
      UPDATE public.tournament_entries
      SET placement=2,
          prize_won = FLOOR(_pool * CASE WHEN (SELECT COUNT(*) FROM public.tournament_entries WHERE tournament_id=_m.tournament_id) >= 3 THEN 0.3 ELSE 0 END)
      WHERE tournament_id=_m.tournament_id AND user_id=_runner;
    END IF;

    -- 3rd place (loser of semifinal with highest match_no, if exists)
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

    -- Credit winnings to balances
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

-- Auto-start tournaments whose start_at has passed
CREATE OR REPLACE FUNCTION public.auto_start_due_tournaments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t record;
  started int := 0;
BEGIN
  FOR t IN
    SELECT id FROM public.tournaments
    WHERE status='upcoming' AND start_at <= now()
      AND (SELECT COUNT(*) FROM public.tournament_entries WHERE tournament_id = tournaments.id) >= 2
  LOOP
    -- Inline start (bypass auth.uid check): mirror start_tournament with admin bypass
    PERFORM public.start_tournament_admin(t.id);
    started := started + 1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'started',started);
END
$$;

-- Admin variant (no auth check) used by cron
CREATE OR REPLACE FUNCTION public.start_tournament_admin(_tid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _t record; _entry_count int; _bracket_size int; _round1_matches int;
  _player_ids uuid[]; i int; _p1 uuid; _p2 uuid;
BEGIN
  SELECT * INTO _t FROM public.tournaments WHERE id=_tid FOR UPDATE;
  IF _t IS NULL OR _t.status <> 'upcoming' THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT COUNT(*) INTO _entry_count FROM public.tournament_entries WHERE tournament_id=_tid;
  IF _entry_count < 2 THEN RETURN jsonb_build_object('ok',false); END IF;

  _bracket_size := 2;
  WHILE _bracket_size < _entry_count LOOP _bracket_size := _bracket_size*2; END LOOP;
  _round1_matches := _bracket_size/2;

  SELECT array_agg(user_id ORDER BY random()) INTO _player_ids
  FROM public.tournament_entries WHERE tournament_id=_tid;

  DELETE FROM public.tournament_matches WHERE tournament_id=_tid;

  FOR i IN 1.._round1_matches LOOP
    _p1 := _player_ids[(i-1)*2 + 1];
    _p2 := _player_ids[(i-1)*2 + 2];
    INSERT INTO public.tournament_matches(tournament_id, round, match_no, player1_id, player2_id, status, winner_id)
    VALUES (_tid, 1, i, _p1, _p2,
            CASE WHEN _p2 IS NULL THEN 'bye' ELSE 'pending' END,
            CASE WHEN _p2 IS NULL THEN _p1 ELSE NULL END);
  END LOOP;

  UPDATE public.tournaments SET status='live', start_at=LEAST(start_at, now()) WHERE id=_tid;
  PERFORM public.advance_bye_winners(_tid);
  RETURN jsonb_build_object('ok',true);
END
$$;

-- Schedule cron every 30 seconds (use two 1-min jobs offset, or 1 minute is fine)
DO $$ BEGIN
  PERFORM cron.unschedule('auto-start-tournaments');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('auto-start-tournaments', '* * * * *', $$ SELECT public.auto_start_due_tournaments(); $$);

-- Revoke broad execute, grant to authenticated only where needed
REVOKE EXECUTE ON FUNCTION public.start_tournament_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_start_due_tournaments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_bye_winners(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_tournament(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_match_winner(uuid, uuid) TO authenticated;
