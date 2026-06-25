CREATE OR REPLACE FUNCTION public.enqueue_matchmaking(
  _mode text,
  _entry_fee numeric,
  _max_players integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _entry_id uuid;
  _peers uuid[];
  _all uuid[];
  _room_id uuid;
  _code text;
  _prize numeric;
  _seat int := 0;
  _pid uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _max_players NOT IN (2, 4) THEN
    RAISE EXCEPTION 'Invalid max_players';
  END IF;

  UPDATE public.matchmaking_queue
    SET status = 'cancelled', updated_at = now()
    WHERE user_id = _uid AND status = 'waiting';

  INSERT INTO public.matchmaking_queue (user_id, mode, entry_fee, max_players, status)
    VALUES (_uid, _mode, _entry_fee, _max_players, 'waiting')
    RETURNING id INTO _entry_id;

  -- Find peers; order inside subquery, aggregate outside without referencing missing col
  SELECT array_agg(id) INTO _peers
  FROM (
    SELECT id FROM public.matchmaking_queue
    WHERE status = 'waiting'
      AND mode = _mode
      AND entry_fee = _entry_fee
      AND max_players = _max_players
      AND user_id <> _uid
    ORDER BY created_at ASC
    LIMIT (_max_players - 1)
    FOR UPDATE SKIP LOCKED
  ) q;

  IF _peers IS NULL OR array_length(_peers, 1) < (_max_players - 1) THEN
    RETURN jsonb_build_object('matched', false, 'queue_id', _entry_id);
  END IF;

  _code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  _prize := floor(_entry_fee * _max_players * 0.9);

  INSERT INTO public.game_rooms (
    code, mode, host_id, entry_fee, prize_pool,
    max_players, current_players, status
  ) VALUES (
    _code, _mode, _uid, _entry_fee, _prize,
    _max_players, _max_players, 'waiting'
  ) RETURNING id INTO _room_id;

  SELECT array_agg(user_id) INTO _all
  FROM public.matchmaking_queue
  WHERE id = ANY(_peers);

  _all := array_prepend(_uid, COALESCE(_all, ARRAY[]::uuid[]));

  FOREACH _pid IN ARRAY _all LOOP
    INSERT INTO public.game_room_players (room_id, user_id, seat)
      VALUES (_room_id, _pid, _seat);
    _seat := _seat + 1;
  END LOOP;

  UPDATE public.matchmaking_queue
    SET status = 'matched', room_id = _room_id, updated_at = now()
    WHERE id = ANY(_peers) OR id = _entry_id;

  RETURN jsonb_build_object('matched', true, 'room_id', _room_id, 'queue_id', _entry_id);
END;
$$;