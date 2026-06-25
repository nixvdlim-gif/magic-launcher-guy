
ALTER TABLE public.game_rooms
  ADD COLUMN IF NOT EXISTS turn_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS turn_seconds integer NOT NULL DEFAULT 30;

CREATE OR REPLACE FUNCTION public.update_turn_timer(_room_id uuid, _turn integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_host uuid;
  v_status room_status;
BEGIN
  SELECT host_id, status INTO v_host, v_status
  FROM public.game_rooms WHERE id = _room_id;
  IF v_host IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_status <> 'in_progress' THEN RETURN; END IF;
  IF v_caller <> v_host AND NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'not_host';
  END IF;

  UPDATE public.game_rooms
  SET current_turn = _turn,
      turn_started_at = now(),
      updated_at = now()
  WHERE id = _room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_timeout_turn(_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.game_rooms%ROWTYPE;
  v_next integer;
  v_deadline timestamptz;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = _room_id FOR UPDATE;
  IF v_room.id IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status <> 'in_progress' THEN
    RETURN jsonb_build_object('skipped', false, 'reason', 'not_in_progress');
  END IF;
  IF v_room.turn_started_at IS NULL THEN
    UPDATE public.game_rooms SET turn_started_at = now() WHERE id = _room_id;
    RETURN jsonb_build_object('skipped', false, 'reason', 'timer_initialized');
  END IF;

  v_deadline := v_room.turn_started_at + (v_room.turn_seconds || ' seconds')::interval;
  IF now() < v_deadline THEN
    RETURN jsonb_build_object(
      'skipped', false,
      'remaining_ms', GREATEST(0, EXTRACT(EPOCH FROM (v_deadline - now())) * 1000)::bigint
    );
  END IF;

  v_next := (COALESCE(v_room.current_turn, 0) + 1) % GREATEST(v_room.max_players, 1);
  UPDATE public.game_rooms
  SET current_turn = v_next,
      turn_started_at = now(),
      updated_at = now()
  WHERE id = _room_id;

  RETURN jsonb_build_object('skipped', true, 'new_turn', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.update_turn_timer(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_timeout_turn(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_turn_timer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_timeout_turn(uuid) TO authenticated;
