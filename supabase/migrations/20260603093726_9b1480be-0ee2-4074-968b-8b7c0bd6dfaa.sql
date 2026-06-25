
DROP FUNCTION IF EXISTS public.fill_tournament_with_bots(uuid);

CREATE FUNCTION public.fill_tournament_with_bots(_tid uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _t record;
  _count int;
  _needed int;
  _added int := 0;
  b record;
BEGIN
  SELECT * INTO _t FROM public.tournaments WHERE id = _tid;
  IF _t IS NULL OR NOT COALESCE(_t.bots_enabled, false) THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO _count FROM public.tournament_entries WHERE tournament_id = _tid;
  _needed := GREATEST(_t.max_players - _count, 0);
  IF _needed = 0 THEN RETURN 0; END IF;

  FOR b IN
    SELECT id FROM public.bots
    WHERE is_active = true
      AND id NOT IN (SELECT user_id FROM public.tournament_entries WHERE tournament_id = _tid)
    ORDER BY random()
    LIMIT _needed
  LOOP
    INSERT INTO public.tournament_entries(tournament_id, user_id) VALUES (_tid, b.id)
    ON CONFLICT DO NOTHING;
    _added := _added + 1;
  END LOOP;

  RETURN _added;
END
$$;

REVOKE EXECUTE ON FUNCTION public.fill_tournament_with_bots(uuid) FROM PUBLIC, anon, authenticated;

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
  i int; _p1 uuid; _p2 uuid;
BEGIN
  SELECT * INTO _t FROM public.tournaments WHERE id = _tid FOR UPDATE;
  IF _t IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _t.status <> 'upcoming' THEN RETURN jsonb_build_object('ok',false,'error','already_started'); END IF;

  IF _uid IS NOT NULL THEN
    _is_admin := public.has_role(_uid,'admin');
    SELECT EXISTS(SELECT 1 FROM public.tournament_entries WHERE tournament_id=_tid AND user_id=_uid) INTO _is_player;
  END IF;

  IF COALESCE(_t.bots_enabled,false) THEN
    PERFORM public.fill_tournament_with_bots(_tid);
  END IF;

  SELECT COUNT(*) INTO _entry_count FROM public.tournament_entries WHERE tournament_id = _tid;
  IF _entry_count < 2 THEN RETURN jsonb_build_object('ok',false,'error','not_enough_players'); END IF;

  IF NOT (_is_admin OR _entry_count >= _t.max_players OR now() >= _t.start_at OR _is_player) THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;

  _bracket_size := 2;
  WHILE _bracket_size < _entry_count LOOP _bracket_size := _bracket_size * 2; END LOOP;
  _round1_matches := _bracket_size / 2;

  SELECT array_agg(user_id ORDER BY random()) INTO _player_ids
  FROM public.tournament_entries WHERE tournament_id = _tid;

  DELETE FROM public.tournament_matches WHERE tournament_id = _tid;

  FOR i IN 1.._round1_matches LOOP
    _p1 := _player_ids[(i-1)*2 + 1];
    _p2 := _player_ids[(i-1)*2 + 2];
    INSERT INTO public.tournament_matches(tournament_id, round, match_no, player1_id, player2_id, status, winner_id)
    VALUES (_tid, 1, i, _p1, _p2,
            CASE WHEN _p2 IS NULL THEN 'bye' ELSE 'pending' END,
            CASE WHEN _p2 IS NULL THEN _p1 ELSE NULL END);
  END LOOP;

  UPDATE public.tournaments SET status='live', start_at = LEAST(start_at, now()) WHERE id = _tid;
  PERFORM public.advance_bye_winners(_tid);

  RETURN jsonb_build_object('ok',true,'bracket_size',_bracket_size,'round1_matches',_round1_matches);
END
$function$;

GRANT EXECUTE ON FUNCTION public.start_tournament(uuid) TO authenticated;

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

  IF COALESCE(_t.bots_enabled,false) THEN
    PERFORM public.fill_tournament_with_bots(_tid);
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.start_tournament_admin(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_start_due_tournaments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t record;
  started int := 0;
  _cnt int;
BEGIN
  FOR t IN
    SELECT id, bots_enabled FROM public.tournaments
    WHERE status='upcoming' AND start_at <= now()
  LOOP
    SELECT COUNT(*) INTO _cnt FROM public.tournament_entries WHERE tournament_id=t.id;
    IF _cnt >= 2 OR (COALESCE(t.bots_enabled,false) AND _cnt >= 1) THEN
      PERFORM public.start_tournament_admin(t.id);
      started := started + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'started',started);
END
$$;

REVOKE EXECUTE ON FUNCTION public.auto_start_due_tournaments() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_tournament_entry_fill_bots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _t record;
BEGIN
  SELECT * INTO _t FROM public.tournaments WHERE id = NEW.tournament_id;
  IF _t IS NULL OR NOT COALESCE(_t.bots_enabled,false) OR _t.status <> 'upcoming' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.bots WHERE id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  PERFORM public.fill_tournament_with_bots(NEW.tournament_id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_tournament_entry_fill_bots ON public.tournament_entries;
CREATE TRIGGER trg_tournament_entry_fill_bots
AFTER INSERT ON public.tournament_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_tournament_entry_fill_bots();
