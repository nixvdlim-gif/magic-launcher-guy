-- Missing columns
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS meta jsonb;
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS turn_seconds int NOT NULL DEFAULT 30;

-- admin_list_users
CREATE OR REPLACE FUNCTION public.admin_list_users(_q text DEFAULT NULL, _limit int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'id', p.id, 'email', u.email, 'username', p.username, 'game_id', p.game_id,
    'created_at', p.created_at, 'total_wins', p.total_wins, 'total_losses', p.total_losses,
    'total_games', p.total_games, 'level', p.level, 'is_blocked', p.is_blocked,
    'is_verified', p.is_verified, 'is_bot', p.is_bot,
    'roles', COALESCE(ARRAY(SELECT role::text FROM public.user_roles WHERE user_id=p.id), ARRAY[]::text[]),
    'deposit_balance', b.deposit_balance, 'winnings_balance', b.winnings_balance
  ))
  INTO _res
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.balances b ON b.user_id = p.id
  WHERE _q IS NULL OR p.username ILIKE '%'||_q||'%' OR p.game_id ILIKE '%'||_q||'%' OR u.email::text ILIKE '%'||_q||'%'
  ORDER BY p.created_at DESC LIMIT _limit;
  RETURN COALESCE(_res, '[]'::jsonb);
END $$;

-- admin_adjust_balance
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _kind text, _amount numeric, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  INSERT INTO public.balances(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  IF _kind = 'winnings' THEN
    UPDATE public.balances SET winnings_balance = GREATEST(0, winnings_balance + _amount), updated_at = now() WHERE user_id = _user_id;
  ELSE
    UPDATE public.balances SET deposit_balance = GREATEST(0, deposit_balance + _amount), updated_at = now() WHERE user_id = _user_id;
  END IF;
  INSERT INTO public.transactions(user_id, type, method, amount, status, processed_at, admin_note)
  VALUES (_user_id, CASE WHEN _amount >= 0 THEN 'bonus' ELSE 'game_entry' END, 'system', abs(_amount), 'approved', now(), COALESCE(_note,'admin adjust'));
  RETURN jsonb_build_object('ok',true);
END $$;

-- admin_update_user
CREATE OR REPLACE FUNCTION public.admin_update_user(_user_id uuid, _username text DEFAULT NULL, _is_verified boolean DEFAULT NULL, _is_blocked boolean DEFAULT NULL, _is_admin boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  UPDATE public.profiles SET
    username = COALESCE(_username, username),
    is_verified = COALESCE(_is_verified, is_verified),
    is_blocked = COALESCE(_is_blocked, is_blocked),
    updated_at = now()
  WHERE id = _user_id;
  IF _is_admin IS NOT NULL THEN
    IF _is_admin THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, 'admin') ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true);
END $$;

-- fx_play_bet (stub)
CREATE OR REPLACE FUNCTION public.fx_play_bet(_stake numeric, _direction text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _bal numeric; _win boolean; _payout numeric;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _stake <= 0 THEN RETURN jsonb_build_object('ok',false,'error','bet_out_of_range','min',1,'max',10000); END IF;
  SELECT (COALESCE(winnings_balance,0) + COALESCE(deposit_balance,0)) INTO _bal FROM public.balances WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_bal,0) < _stake THEN RETURN jsonb_build_object('ok',false,'error','insufficient_balance'); END IF;
  UPDATE public.balances SET winnings_balance = GREATEST(0, winnings_balance - _stake), updated_at = now() WHERE user_id = _uid;
  _win := random() < 0.48;
  _payout := CASE WHEN _win THEN _stake * 1.9 ELSE 0 END;
  IF _payout > 0 THEN
    UPDATE public.balances SET winnings_balance = winnings_balance + _payout, updated_at = now() WHERE user_id = _uid;
  END IF;
  RETURN jsonb_build_object('ok',true,'won',_win,'payout',_payout,'direction',_direction);
END $$;

-- Royal Steps (stub)
CREATE TABLE IF NOT EXISTS public.royal_steps_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bet numeric NOT NULL,
  step int NOT NULL DEFAULT 0,
  multipliers numeric[] NOT NULL,
  max_steps int NOT NULL,
  status text NOT NULL DEFAULT 'active',
  payout numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.royal_steps_rounds TO authenticated;
GRANT ALL ON public.royal_steps_rounds TO service_role;
ALTER TABLE public.royal_steps_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rounds" ON public.royal_steps_rounds FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.royal_steps_start(_bet numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _bal numeric; _mults numeric[]; _id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _bet <= 0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_bet'); END IF;
  SELECT (COALESCE(winnings_balance,0) + COALESCE(deposit_balance,0)) INTO _bal FROM public.balances WHERE user_id=_uid FOR UPDATE;
  IF COALESCE(_bal,0) < _bet THEN RETURN jsonb_build_object('ok',false,'error','insufficient_balance'); END IF;
  UPDATE public.balances SET winnings_balance = GREATEST(0, winnings_balance - _bet), updated_at = now() WHERE user_id=_uid;
  _mults := ARRAY[1.2, 1.5, 2.0, 2.7, 3.8, 5.5, 8.0, 12.0];
  INSERT INTO public.royal_steps_rounds(user_id, bet, multipliers, max_steps)
  VALUES (_uid, _bet, _mults, array_length(_mults,1)) RETURNING id INTO _id;
  RETURN jsonb_build_object('ok',true,'id',_id,'bet',_bet,'multipliers',_mults,'max_steps',array_length(_mults,1));
END $$;

CREATE OR REPLACE FUNCTION public.royal_steps_step(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record; _busted boolean;
BEGIN
  SELECT * INTO _r FROM public.royal_steps_rounds WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _r.status <> 'active' THEN RETURN jsonb_build_object('ok',false,'error','finished'); END IF;
  _busted := random() < 0.25;
  IF _busted THEN
    UPDATE public.royal_steps_rounds SET status='busted', step=_r.step+1 WHERE id=_id;
    RETURN jsonb_build_object('ok',true,'busted',true,'step',_r.step+1);
  END IF;
  UPDATE public.royal_steps_rounds SET step=_r.step+1, status=CASE WHEN _r.step+1 >= _r.max_steps THEN 'won' ELSE 'active' END WHERE id=_id;
  RETURN jsonb_build_object('ok',true,'busted',false,'step',_r.step+1);
END $$;

CREATE OR REPLACE FUNCTION public.royal_steps_cashout(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record; _payout numeric;
BEGIN
  SELECT * INTO _r FROM public.royal_steps_rounds WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF _r.status <> 'active' OR _r.step < 1 THEN RETURN jsonb_build_object('ok',false,'error','cannot_cashout'); END IF;
  _payout := round(_r.bet * _r.multipliers[_r.step], 2);
  UPDATE public.royal_steps_rounds SET status='cashed', payout=_payout WHERE id=_id;
  UPDATE public.balances SET winnings_balance = winnings_balance + _payout, updated_at = now() WHERE user_id=auth.uid();
  RETURN jsonb_build_object('ok',true,'payout',_payout);
END $$;

-- add_bot_to_room (stub)
CREATE OR REPLACE FUNCTION public.add_bot_to_room(_room_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bot_id uuid;
BEGIN
  SELECT id INTO _bot_id FROM public.bots WHERE is_active = true ORDER BY random() LIMIT 1;
  IF _bot_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_bots'); END IF;
  INSERT INTO public.game_room_players(room_id, user_id, is_bot) VALUES (_room_id, _bot_id, true) ON CONFLICT DO NOTHING;
  UPDATE public.game_rooms SET current_players = current_players + 1, updated_at = now() WHERE id = _room_id;
  RETURN jsonb_build_object('ok',true,'bot_id',_bot_id);
END $$;

-- start_tournament & report_match_winner (stubs)
CREATE OR REPLACE FUNCTION public.start_tournament(_tid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  UPDATE public.tournaments SET status='live', updated_at=now() WHERE id=_tid;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.report_match_winner(_match_id uuid, _winner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tournament_matches SET winner_id=_winner_id, status='finished', updated_at=now() WHERE id=_match_id;
  RETURN jsonb_build_object('ok',true);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid,text,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid,text,boolean,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fx_play_bet(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.royal_steps_start(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.royal_steps_step(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.royal_steps_cashout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_bot_to_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_tournament(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_match_winner(uuid,uuid) TO authenticated;