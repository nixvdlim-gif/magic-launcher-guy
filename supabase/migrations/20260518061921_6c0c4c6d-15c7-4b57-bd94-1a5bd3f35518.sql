
-- Missing columns
ALTER TABLE public.payment_settings
  ADD COLUMN display_name text,
  ADD COLUMN receive_number text,
  ADD COLUMN min_deposit numeric NOT NULL DEFAULT 50,
  ADD COLUMN max_deposit numeric NOT NULL DEFAULT 50000,
  ADD COLUMN min_withdraw numeric NOT NULL DEFAULT 100,
  ADD COLUMN max_withdraw numeric NOT NULL DEFAULT 25000,
  ADD COLUMN instructions_image_url text,
  ADD COLUMN bank_name text,
  ADD COLUMN bank_branch text,
  ADD COLUMN logo_url text,
  ADD COLUMN supports_deposit boolean NOT NULL DEFAULT true,
  ADD COLUMN supports_withdraw boolean NOT NULL DEFAULT true;

ALTER TABLE public.transactions
  ADD COLUMN sender_number text,
  ADD COLUMN receiver_number text,
  ADD COLUMN bank_account_name text,
  ADD COLUMN bank_account_number text,
  ADD COLUMN bank_name text;

ALTER TABLE public.kyc_submissions ADD COLUMN doc_image_url text;

ALTER TABLE public.game_rooms
  ADD COLUMN state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN current_turn int NOT NULL DEFAULT 0,
  ADD COLUMN turn_started_at timestamptz;

ALTER TABLE public.game_room_players
  ADD COLUMN is_bot boolean NOT NULL DEFAULT false;

ALTER TABLE public.emoji_categories ADD COLUMN name_bn text;

-- ============= RPC FUNCTIONS =============
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _has boolean;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') INTO _has;
  IF _has THEN RETURN jsonb_build_object('ok',false,'error','admin_exists'); END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid,'admin') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.get_my_phone()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT phone FROM auth.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.transfer_balance(_to_game_id text, _amount numeric, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _from uuid := auth.uid(); _to uuid; _bal numeric;
BEGIN
  IF _from IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _amount <= 0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_amount'); END IF;
  SELECT id INTO _to FROM public.profiles WHERE game_id = _to_game_id;
  IF _to IS NULL OR _to = _from THEN RETURN jsonb_build_object('ok',false,'error','invalid_recipient'); END IF;
  SELECT winnings_balance INTO _bal FROM public.balances WHERE user_id = _from FOR UPDATE;
  IF COALESCE(_bal,0) < _amount THEN RETURN jsonb_build_object('ok',false,'error','insufficient_balance'); END IF;
  UPDATE public.balances SET winnings_balance = winnings_balance - _amount WHERE user_id = _from;
  INSERT INTO public.balances(user_id) VALUES (_to) ON CONFLICT DO NOTHING;
  UPDATE public.balances SET deposit_balance = deposit_balance + _amount WHERE user_id = _to;
  INSERT INTO public.balance_transfers(from_user, to_user, amount, note) VALUES (_from, _to, _amount, _note);
  INSERT INTO public.transactions(user_id, type, method, amount, status) VALUES
    (_from,'transfer_out','transfer',_amount,'completed'),
    (_to,'transfer_in','transfer',_amount,'completed');
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _today date := CURRENT_DATE; _yest date; _streak int := 1; _amount numeric;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF EXISTS(SELECT 1 FROM public.daily_bonuses WHERE user_id=_uid AND claimed_on=_today) THEN
    RETURN jsonb_build_object('ok',false,'error','already_claimed');
  END IF;
  _yest := _today - 1;
  SELECT day_streak + 1 INTO _streak FROM public.daily_bonuses WHERE user_id=_uid AND claimed_on=_yest;
  _streak := COALESCE(_streak,1);
  _amount := LEAST(10 + _streak * 5, 100);
  INSERT INTO public.daily_bonuses(user_id, amount, day_streak, claimed_on) VALUES (_uid, _amount, _streak, _today);
  INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  UPDATE public.balances SET winnings_balance = winnings_balance + _amount WHERE user_id=_uid;
  INSERT INTO public.transactions(user_id,type,method,amount,status) VALUES (_uid,'bonus','daily',_amount,'completed');
  RETURN jsonb_build_object('ok',true,'amount',_amount,'streak',_streak);
END $$;

CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _amounts numeric[] := ARRAY[1,2,5,10,20,50]; _amt numeric; _label text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  _amt := _amounts[1 + floor(random()*array_length(_amounts,1))::int];
  _label := '৳' || _amt::text;
  INSERT INTO public.spin_history(user_id, reward_label, reward_amount) VALUES (_uid, _label, _amt);
  INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  UPDATE public.balances SET winnings_balance = winnings_balance + _amt WHERE user_id=_uid;
  RETURN jsonb_build_object('ok',true,'amount',_amt,'label',_label);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c record;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  SELECT * INTO _c FROM public.coupons WHERE code = _code AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','invalid_code'); END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RETURN jsonb_build_object('ok',false,'error','expired'); END IF;
  IF _c.used_count >= _c.max_uses THEN RETURN jsonb_build_object('ok',false,'error','limit_reached'); END IF;
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _c.id;
  INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  UPDATE public.balances SET winnings_balance = winnings_balance + _c.amount WHERE user_id=_uid;
  INSERT INTO public.transactions(user_id,type,method,amount,status) VALUES (_uid,'bonus','coupon',_c.amount,'completed');
  RETURN jsonb_build_object('ok',true,'amount',_c.amount);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_emoji(_emoji_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _price numeric; _bal numeric;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF EXISTS(SELECT 1 FROM public.emoji_purchases WHERE user_id=_uid AND emoji_id=_emoji_id) THEN
    RETURN jsonb_build_object('ok',false,'error','already_owned');
  END IF;
  SELECT price INTO _price FROM public.emoji_items WHERE id=_emoji_id AND is_active;
  IF _price IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  SELECT winnings_balance INTO _bal FROM public.balances WHERE user_id=_uid FOR UPDATE;
  IF COALESCE(_bal,0) < _price THEN RETURN jsonb_build_object('ok',false,'error','insufficient_balance'); END IF;
  UPDATE public.balances SET winnings_balance = winnings_balance - _price WHERE user_id=_uid;
  INSERT INTO public.emoji_purchases(user_id, emoji_id) VALUES (_uid, _emoji_id);
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.send_chat_message(_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RETURN jsonb_build_object('ok',false,'error','empty'); END IF;
  IF length(_body) > 500 THEN RETURN jsonb_build_object('ok',false,'error','too_long'); END IF;
  INSERT INTO public.chat_messages(user_id, body) VALUES (_uid, trim(_body));
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.finish_solo_game(_room_id uuid, _won boolean, _entry_fee numeric DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _prize numeric := 0;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _won THEN _prize := _entry_fee * 2; END IF;
  INSERT INTO public.game_results(room_id, user_id, mode, entry_fee, prize_awarded, is_winner)
  VALUES (_room_id, _uid, 'solo', _entry_fee, _prize, _won);
  UPDATE public.profiles SET
    total_games = total_games + 1,
    total_wins = total_wins + CASE WHEN _won THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN _won THEN 0 ELSE 1 END
  WHERE id = _uid;
  IF _prize > 0 THEN
    INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
    UPDATE public.balances SET winnings_balance = winnings_balance + _prize WHERE user_id=_uid;
  END IF;
  UPDATE public.game_rooms SET status='completed', ended_at=now() WHERE id=_room_id;
  RETURN jsonb_build_object('ok',true,'prize',_prize);
END $$;

CREATE OR REPLACE FUNCTION public.finish_multi_game(_room_id uuid, _winner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _room record; _player record; _pot numeric; _prize numeric;
BEGIN
  SELECT * INTO _room FROM public.game_rooms WHERE id=_room_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','no_room'); END IF;
  _pot := _room.entry_fee * _room.current_players;
  _prize := _pot * 0.9;
  FOR _player IN SELECT user_id FROM public.game_room_players WHERE room_id=_room_id LOOP
    INSERT INTO public.game_results(room_id, user_id, mode, entry_fee, prize_awarded, is_winner)
    VALUES (_room_id, _player.user_id, _room.mode, _room.entry_fee,
            CASE WHEN _player.user_id = _winner_id THEN _prize ELSE 0 END,
            _player.user_id = _winner_id);
    UPDATE public.profiles SET
      total_games = total_games + 1,
      total_wins = total_wins + CASE WHEN _player.user_id = _winner_id THEN 1 ELSE 0 END,
      total_losses = total_losses + CASE WHEN _player.user_id = _winner_id THEN 0 ELSE 1 END
    WHERE id = _player.user_id;
  END LOOP;
  INSERT INTO public.balances(user_id) VALUES (_winner_id) ON CONFLICT DO NOTHING;
  UPDATE public.balances SET winnings_balance = winnings_balance + _prize WHERE user_id = _winner_id;
  UPDATE public.game_rooms SET status='completed', ended_at=now() WHERE id=_room_id;
  RETURN jsonb_build_object('ok',true,'prize',_prize);
END $$;

CREATE OR REPLACE FUNCTION public.add_bot_to_room(_room_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bot_uid uuid;
BEGIN
  _bot_uid := gen_random_uuid();
  RETURN jsonb_build_object('ok',true,'bot_id',_bot_uid);
END $$;

CREATE OR REPLACE FUNCTION public.start_tournament(_tid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  UPDATE public.tournaments SET status='live', start_at=now() WHERE id=_tid;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.report_match_winner(_match_id uuid, _winner uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tournament_matches SET winner=_winner, status='completed' WHERE id=_match_id;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.broadcast_notification(_title text, _body text, _type text DEFAULT 'admin')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  INSERT INTO public.notifications(user_id, type, title, body)
  SELECT id, _type, _title, _body FROM auth.users;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'count',_count);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(_q text DEFAULT NULL, _limit int DEFAULT 100)
RETURNS TABLE(id uuid, email text, username text, game_id text, created_at timestamptz, total_wins int, total_losses int, total_games int, level int, is_blocked boolean, is_verified boolean, roles text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, u.email::text, p.username, p.game_id, p.created_at,
         p.total_wins, p.total_losses, p.total_games, p.level, p.is_blocked, p.is_verified,
         COALESCE(ARRAY(SELECT role::text FROM public.user_roles WHERE user_id=p.id), ARRAY[]::text[])
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE _q IS NULL OR p.username ILIKE '%'||_q||'%' OR p.game_id ILIKE '%'||_q||'%' OR u.email ILIKE '%'||_q||'%'
  ORDER BY p.created_at DESC LIMIT _limit;
END $$;

-- Lock down SECURITY DEFINER funcs from anon where possible
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text,int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.broadcast_notification(text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_tournament(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
