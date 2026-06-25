-- 1. profiles.is_bot
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_is_bot ON public.profiles(is_bot) WHERE is_bot = true;

-- 2. seed bot_config
INSERT INTO public.app_settings (key, value)
VALUES ('bot_config', jsonb_build_object(
  'enabled', true,
  'delay_seconds', 25,
  'win_rate', 40,
  'avatars', jsonb_build_array(),
  'names', jsonb_build_array(
    'Rahim','Karim','Sakib','Tamim','Mehedi','Arif','Niloy','Rifat','Sohag','Jubayer',
    'Tanvir','Imran','Rakib','Shakil','Nayeem','Shanto','Ridoy','Rasel','Mizan','Hasib',
    'Faisal','Tushar','Anik','Sajid','Naim','Robin','Sumon','Mamun','Jewel','Polash',
    'Sabbir','Tareq','Asif','Nahid','Bappy','Hossain','Mahin','Rana','Sourov','Fahim',
    'Jihad','Riyad','Limon','Saif','Tonmoy','Pavel','Sajib','Kamrul','Abir','Tofazzal',
    'Shihab','Mahmud','Roni','Sumaiya','Mim','Tania','Sadia','Nusrat','Rumana','Jannat'
  ),
  'per_mode', jsonb_build_object(
    'classic', jsonb_build_object('delay', 25, 'win_rate', 40),
    'speed',   jsonb_build_object('delay', 15, 'win_rate', 45),
    'quick',   jsonb_build_object('delay', 12, 'win_rate', 45),
    'time',    jsonb_build_object('delay', 20, 'win_rate', 40)
  )
))
ON CONFLICT (key) DO NOTHING;

-- 3. fill_queue_with_bots
CREATE OR REPLACE FUNCTION public.fill_queue_with_bots()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _cfg jsonb;
  _enabled boolean;
  _default_delay int;
  _names jsonb;
  _avatars jsonb;
  _per_mode jsonb;
  _name_count int;
  _avatar_count int;
  _q record;
  _delay int;
  _peers uuid[];
  _bot_id uuid;
  _bot_name text;
  _bot_avatar text;
  _bot_username text;
  _bot_game_id text;
  _room_id uuid;
  _code text;
  _prize numeric;
  _seat int;
  _all uuid[];
  _pid uuid;
  _bots_needed int;
  _i int;
  _filled int := 0;
BEGIN
  SELECT value INTO _cfg FROM public.app_settings WHERE key = 'bot_config';
  IF _cfg IS NULL THEN RETURN 0; END IF;
  _enabled := COALESCE((_cfg->>'enabled')::boolean, false);
  IF NOT _enabled THEN RETURN 0; END IF;

  _default_delay := COALESCE((_cfg->>'delay_seconds')::int, 25);
  _names := COALESCE(_cfg->'names', '[]'::jsonb);
  _avatars := COALESCE(_cfg->'avatars', '[]'::jsonb);
  _per_mode := COALESCE(_cfg->'per_mode', '{}'::jsonb);
  _name_count := jsonb_array_length(_names);
  _avatar_count := jsonb_array_length(_avatars);
  IF _name_count = 0 THEN RETURN 0; END IF;

  -- iterate aged waiting entries
  FOR _q IN
    SELECT id, user_id, mode, entry_fee, max_players, created_at
    FROM public.matchmaking_queue
    WHERE status = 'waiting'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    _delay := COALESCE((_per_mode->_q.mode->>'delay')::int, _default_delay);
    IF EXTRACT(EPOCH FROM (now() - _q.created_at)) < _delay THEN
      CONTINUE;
    END IF;

    -- count available real peers (don't bot if a real peer is also waiting)
    SELECT array_agg(id) INTO _peers
    FROM (
      SELECT id FROM public.matchmaking_queue
      WHERE status = 'waiting'
        AND mode = _q.mode
        AND entry_fee = _q.entry_fee
        AND max_players = _q.max_players
        AND user_id <> _q.user_id
      ORDER BY created_at ASC
      LIMIT (_q.max_players - 1)
      FOR UPDATE SKIP LOCKED
    ) sub;

    _bots_needed := _q.max_players - 1 - COALESCE(array_length(_peers, 1), 0);
    IF _bots_needed <= 0 THEN
      -- enough real players; let normal enqueue handle on next call. skip.
      CONTINUE;
    END IF;

    -- create room
    _code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    _prize := floor(_q.entry_fee * _q.max_players * 0.9);
    INSERT INTO public.game_rooms (
      code, mode, host_id, entry_fee, prize_pool,
      max_players, current_players, status
    ) VALUES (
      _code, _q.mode, _q.user_id, _q.entry_fee, _prize,
      _q.max_players, _q.max_players, 'waiting'
    ) RETURNING id INTO _room_id;

    -- collect real peer user ids
    SELECT array_agg(user_id) INTO _all
    FROM public.matchmaking_queue WHERE id = ANY(COALESCE(_peers, ARRAY[]::uuid[]));
    _all := array_prepend(_q.user_id, COALESCE(_all, ARRAY[]::uuid[]));

    _seat := 0;
    -- seat real players first
    FOREACH _pid IN ARRAY _all LOOP
      INSERT INTO public.game_room_players (room_id, user_id, seat, is_bot)
        VALUES (_room_id, _pid, _seat, false);
      _seat := _seat + 1;
    END LOOP;

    -- create + seat bot players
    FOR _i IN 1.._bots_needed LOOP
      _bot_id := gen_random_uuid();
      _bot_name := (_names->>floor(random() * _name_count)::int);
      IF _avatar_count > 0 THEN
        _bot_avatar := (_avatars->>floor(random() * _avatar_count)::int);
      ELSE
        _bot_avatar := NULL;
      END IF;
      _bot_username := _bot_name || floor(random() * 9000 + 1000)::text;
      _bot_game_id := 'B' || substring(replace(_bot_id::text, '-', ''), 1, 8);

      INSERT INTO public.profiles (id, username, game_id, avatar_url, is_bot, is_verified)
        VALUES (_bot_id, _bot_username, _bot_game_id, _bot_avatar, true, true);

      INSERT INTO public.game_room_players (room_id, user_id, seat, is_bot)
        VALUES (_room_id, _bot_id, _seat, true);
      _seat := _seat + 1;
    END LOOP;

    -- mark queue entries matched
    UPDATE public.matchmaking_queue
      SET status = 'matched', room_id = _room_id, updated_at = now()
      WHERE id = ANY(COALESCE(_peers, ARRAY[]::uuid[])) OR id = _q.id;

    _filled := _filled + 1;
  END LOOP;

  RETURN _filled;
END;
$$;

REVOKE ALL ON FUNCTION public.fill_queue_with_bots() FROM PUBLIC, anon, authenticated;

-- 4. enable extensions + schedule (every 10 sec)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('mm-bot-fill');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('mm-bot-fill', '10 seconds', $$ SELECT public.fill_queue_with_bots(); $$);