
CREATE OR REPLACE FUNCTION public.add_bot_to_room(_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _host uuid;
  _max int;
  _next_seat int;
  _bot_id uuid;
  _filled int;
BEGIN
  SELECT host_id, max_players INTO _host, _max
  FROM public.game_rooms WHERE id = _room_id;
  IF _host IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF _host <> auth.uid() THEN RAISE EXCEPTION 'Only host can add bots'; END IF;

  SELECT count(*) INTO _filled FROM public.game_room_players WHERE room_id = _room_id;
  IF _filled >= _max THEN RAISE EXCEPTION 'Room is full'; END IF;

  -- find next free seat 0.._max-1
  SELECT g.s INTO _next_seat
  FROM generate_series(0, _max - 1) AS g(s)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.game_room_players p
    WHERE p.room_id = _room_id AND p.seat = g.s
  )
  ORDER BY g.s LIMIT 1;

  -- pick a bot not already in this room
  SELECT pr.id INTO _bot_id
  FROM public.profiles pr
  WHERE pr.is_bot = true
    AND NOT EXISTS (
      SELECT 1 FROM public.game_room_players p
      WHERE p.room_id = _room_id AND p.user_id = pr.id
    )
  ORDER BY random()
  LIMIT 1;
  IF _bot_id IS NULL THEN RAISE EXCEPTION 'No available bot profiles'; END IF;

  INSERT INTO public.game_room_players (room_id, user_id, seat, is_bot)
  VALUES (_room_id, _bot_id, _next_seat, true);

  UPDATE public.game_rooms
  SET current_players = _filled + 1
  WHERE id = _room_id;

  RETURN _bot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_bot_to_room(uuid) TO authenticated;
