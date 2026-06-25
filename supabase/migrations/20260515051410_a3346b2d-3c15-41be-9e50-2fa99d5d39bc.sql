
-- Add bots_enabled flag and helper RPCs to manage bot entries per tournament

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS bots_enabled boolean NOT NULL DEFAULT true;

-- Fill remaining slots in a tournament with bot entries (admin only)
CREATE OR REPLACE FUNCTION public.fill_tournament_with_bots(_tid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t record;
  v_have int;
  v_need int;
  v_added int := 0;
  v_bot record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_t FROM public.tournaments WHERE id = _tid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF NOT v_t.bots_enabled THEN RAISE EXCEPTION 'Bots are disabled for this tournament'; END IF;
  IF v_t.status <> 'upcoming' THEN RAISE EXCEPTION 'Tournament already started'; END IF;

  SELECT count(*) INTO v_have FROM public.tournament_entries WHERE tournament_id = _tid;
  v_need := GREATEST(v_t.max_players - v_have, 0);

  FOR v_bot IN
    SELECT p.id FROM public.profiles p
    WHERE p.is_bot = true
      AND p.id NOT IN (SELECT user_id FROM public.tournament_entries WHERE tournament_id = _tid)
    ORDER BY random()
    LIMIT v_need
  LOOP
    INSERT INTO public.tournament_entries (tournament_id, user_id) VALUES (_tid, v_bot.id);
    v_added := v_added + 1;
  END LOOP;

  RETURN jsonb_build_object('added', v_added, 'total', v_have + v_added, 'max', v_t.max_players);
END;
$$;

-- Remove all bot entries from a tournament (admin only)
CREATE OR REPLACE FUNCTION public.remove_bots_from_tournament(_tid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH del AS (
    DELETE FROM public.tournament_entries te
    USING public.profiles p
    WHERE te.tournament_id = _tid AND te.user_id = p.id AND p.is_bot = true
    RETURNING te.id
  )
  SELECT count(*) INTO v_removed FROM del;

  RETURN jsonb_build_object('removed', v_removed);
END;
$$;

-- Update auto_advance_bot_matches to respect the bots_enabled flag
CREATE OR REPLACE FUNCTION public.auto_advance_bot_matches(_tid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t record;
  v_match record;
  v_p1_bot boolean;
  v_p2_bot boolean;
  v_winner uuid;
  v_resolved int := 0;
BEGIN
  SELECT * INTO v_t FROM public.tournaments WHERE id = _tid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF NOT v_t.bots_enabled THEN
    RETURN jsonb_build_object('resolved', 0, 'skipped', 'bots_disabled');
  END IF;

  LOOP
    SELECT m.* INTO v_match
    FROM public.tournament_matches m
    WHERE m.tournament_id = _tid
      AND m.status = 'pending'
      AND m.player1_id IS NOT NULL
      AND m.player2_id IS NOT NULL
    ORDER BY m.round, m.match_no
    LIMIT 1;
    EXIT WHEN NOT FOUND;

    SELECT is_bot INTO v_p1_bot FROM public.profiles WHERE id = v_match.player1_id;
    SELECT is_bot INTO v_p2_bot FROM public.profiles WHERE id = v_match.player2_id;

    IF v_p1_bot AND v_p2_bot THEN
      v_winner := CASE WHEN random() < 0.5 THEN v_match.player1_id ELSE v_match.player2_id END;
      UPDATE public.tournament_matches
        SET winner_id = v_winner, status = 'finished', updated_at = now()
        WHERE id = v_match.id;
      PERFORM public.advance_tournament_round(_tid);
      v_resolved := v_resolved + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('resolved', v_resolved);
END;
$$;
