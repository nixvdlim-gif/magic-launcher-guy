
-- payment_settings rename/add
ALTER TABLE public.payment_settings RENAME COLUMN supports_deposit TO deposit_enabled;
ALTER TABLE public.payment_settings RENAME COLUMN supports_withdraw TO withdraw_enabled;
ALTER TABLE public.payment_settings ADD COLUMN icon text;
ALTER TABLE public.payment_settings ADD COLUMN color text;

-- balance_transfers rename
ALTER TABLE public.balance_transfers RENAME COLUMN from_user TO sender_id;
ALTER TABLE public.balance_transfers RENAME COLUMN to_user TO recipient_id;
ALTER TABLE public.balance_transfers ADD COLUMN fee_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.balance_transfers ADD COLUMN recipient_received numeric NOT NULL DEFAULT 0;

-- emoji_items
ALTER TABLE public.emoji_items ADD COLUMN name_bn text;
ALTER TABLE public.emoji_items ADD COLUMN emoji_char text;
ALTER TABLE public.emoji_items ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
UPDATE public.emoji_items SET emoji_char = emoji WHERE emoji_char IS NULL;

-- transactions
ALTER TABLE public.transactions ADD COLUMN reference text;
ALTER TABLE public.transactions ADD COLUMN admin_note text;

-- kyc rename
ALTER TABLE public.kyc_submissions RENAME COLUMN document_type TO doc_type;
ALTER TABLE public.kyc_submissions RENAME COLUMN document_number TO doc_number;

-- game_rooms
ALTER TABLE public.game_rooms ADD COLUMN prize_pool numeric NOT NULL DEFAULT 0;
ALTER TABLE public.game_rooms ADD COLUMN turn_seconds int NOT NULL DEFAULT 30;

-- tournaments
ALTER TABLE public.tournaments ADD COLUMN banner_url text;
ALTER TABLE public.tournaments ADD COLUMN bots_enabled boolean NOT NULL DEFAULT false;

-- tournament_entries rename
ALTER TABLE public.tournament_entries RENAME COLUMN position TO placement;
ALTER TABLE public.tournament_entries RENAME COLUMN prize_awarded TO prize_won;
ALTER TABLE public.tournament_entries ADD COLUMN joined_at timestamptz NOT NULL DEFAULT now();

-- tournament_matches rename
ALTER TABLE public.tournament_matches RENAME COLUMN player_1 TO player1_id;
ALTER TABLE public.tournament_matches RENAME COLUMN player_2 TO player2_id;
ALTER TABLE public.tournament_matches RENAME COLUMN winner TO winner_id;
ALTER TABLE public.tournament_matches ADD COLUMN match_no int NOT NULL DEFAULT 1;

-- profiles language
ALTER TABLE public.profiles ADD COLUMN language text NOT NULL DEFAULT 'bn';

-- bots avatar
ALTER TABLE public.bots ADD COLUMN avatar_url text;

-- agents
ALTER TABLE public.agents ADD COLUMN whatsapp text;
ALTER TABLE public.agents ADD COLUMN area text;
ALTER TABLE public.agents ADD COLUMN notes text;

-- app_settings updated_by
ALTER TABLE public.app_settings ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- ==== Replace transfer_balance with renamed param ====
DROP FUNCTION IF EXISTS public.transfer_balance(text, numeric, text);
CREATE OR REPLACE FUNCTION public.transfer_balance(_recipient_game_id text, _amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _from uuid := auth.uid(); _to uuid; _bal numeric; _fee numeric; _recv numeric;
BEGIN
  IF _from IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _amount <= 0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_amount'); END IF;
  SELECT id INTO _to FROM public.profiles WHERE game_id = _recipient_game_id;
  IF _to IS NULL OR _to = _from THEN RETURN jsonb_build_object('ok',false,'error','invalid_recipient'); END IF;
  SELECT winnings_balance INTO _bal FROM public.balances WHERE user_id = _from FOR UPDATE;
  IF COALESCE(_bal,0) < _amount THEN RETURN jsonb_build_object('ok',false,'error','insufficient_balance'); END IF;
  _fee := round(_amount * 0.02, 2);
  _recv := _amount - _fee;
  UPDATE public.balances SET winnings_balance = winnings_balance - _amount WHERE user_id = _from;
  INSERT INTO public.balances(user_id) VALUES (_to) ON CONFLICT DO NOTHING;
  UPDATE public.balances SET deposit_balance = deposit_balance + _recv WHERE user_id = _to;
  INSERT INTO public.balance_transfers(sender_id, recipient_id, amount, fee_amount, recipient_received)
  VALUES (_from, _to, _amount, _fee, _recv);
  INSERT INTO public.transactions(user_id, type, method, amount, status) VALUES
    (_from,'transfer_out','transfer',_amount,'completed'),
    (_to,'transfer_in','transfer',_recv,'completed');
  RETURN jsonb_build_object('ok',true,'amount',_amount,'fee',_fee,'received',_recv);
END $$;

-- ==== report_match_winner rename ====
DROP FUNCTION IF EXISTS public.report_match_winner(uuid, uuid);
CREATE OR REPLACE FUNCTION public.report_match_winner(_match_id uuid, _winner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tournament_matches SET winner_id = _winner_id, status='completed' WHERE id = _match_id;
  RETURN jsonb_build_object('ok',true);
END $$;

-- ==== claim_first_admin returns text ====
DROP FUNCTION IF EXISTS public.claim_first_admin();
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _has boolean;
BEGIN
  IF _uid IS NULL THEN RETURN 'not_logged_in'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') INTO _has;
  IF _has THEN RETURN 'exists'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid,'admin') ON CONFLICT DO NOTHING;
  RETURN 'granted';
END $$;

-- ==== Add missing RPC stubs used with `as any` (return jsonb) ====
CREATE OR REPLACE FUNCTION public.fill_tournament_with_bots(_tid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.auto_advance_bot_matches(_tid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN jsonb_build_object('ok',true); END $$;

CREATE OR REPLACE FUNCTION public.remove_bots_from_tournament(_tid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.update_turn_timer(_room_id uuid, _turn int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.game_rooms SET turn_started_at = now(), current_turn = _turn WHERE id = _room_id;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.auto_timeout_turn(_room_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record;
BEGIN
  SELECT current_turn, turn_seconds, turn_started_at, current_players FROM public.game_rooms WHERE id=_room_id INTO _r;
  IF NOT FOUND OR _r.turn_started_at IS NULL THEN RETURN jsonb_build_object('timed_out',false); END IF;
  IF EXTRACT(EPOCH FROM (now() - _r.turn_started_at)) > _r.turn_seconds THEN
    UPDATE public.game_rooms SET current_turn = (_r.current_turn + 1) % GREATEST(_r.current_players,1), turn_started_at = now() WHERE id=_room_id;
    RETURN jsonb_build_object('timed_out',true);
  END IF;
  RETURN jsonb_build_object('timed_out',false);
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_matchmaking(_mode text, _entry_fee numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN jsonb_build_object('ok',true); END $$;

CREATE OR REPLACE FUNCTION public.leave_matchmaking()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN jsonb_build_object('ok',true); END $$;

-- Set search_path on functions that didn't have it
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Lock all SECURITY DEFINER funcs from anon (signed-in only)
REVOKE EXECUTE ON FUNCTION public.transfer_balance(text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_match_winner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_daily_bonus() FROM anon;
REVOKE EXECUTE ON FUNCTION public.spin_wheel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_emoji(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_chat_message(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finish_solo_game(uuid, boolean, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finish_multi_game(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_bot_to_room(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fill_tournament_with_bots(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_advance_bot_matches(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_bots_from_tournament(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_turn_timer(uuid, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_timeout_turn(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_matchmaking(text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_matchmaking() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_phone() FROM anon;
