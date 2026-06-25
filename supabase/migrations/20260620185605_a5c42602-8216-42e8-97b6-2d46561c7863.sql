
-- FX Casino: settings + bet RPC
INSERT INTO public.app_settings(key, value)
VALUES ('fx_casino', jsonb_build_object(
  'enabled', true,
  'min_bet', 10,
  'max_bet', 1000,
  'win_chance', 0.45,
  'payout_multiplier', 1.9,
  'preset_stakes', jsonb_build_array(10,50,100,250,500,1000)
))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fx_play_bet(_stake numeric, _direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cfg jsonb;
  _enabled bool;
  _min numeric; _max numeric; _wc numeric; _mult numeric;
  _dep numeric; _win numeric;
  _outcome bool;
  _payout numeric := 0;
  _profit numeric := 0;
  _room_id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_logged_in'); END IF;
  IF _direction NOT IN ('BUY','SELL') THEN RETURN jsonb_build_object('ok',false,'error','invalid_direction'); END IF;

  _cfg := COALESCE((SELECT value FROM public.app_settings WHERE key='fx_casino'),'{}'::jsonb);
  _enabled := COALESCE((_cfg->>'enabled')::bool, true);
  _min := COALESCE((_cfg->>'min_bet')::numeric, 10);
  _max := COALESCE((_cfg->>'max_bet')::numeric, 1000);
  _wc  := COALESCE((_cfg->>'win_chance')::numeric, 0.45);
  _mult:= COALESCE((_cfg->>'payout_multiplier')::numeric, 1.9);

  IF NOT _enabled THEN RETURN jsonb_build_object('ok',false,'error','disabled'); END IF;
  IF _stake IS NULL OR _stake < _min OR _stake > _max THEN
    RETURN jsonb_build_object('ok',false,'error','bet_out_of_range','min',_min,'max',_max);
  END IF;

  INSERT INTO public.balances(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT deposit_balance, winnings_balance INTO _dep, _win
    FROM public.balances WHERE user_id=_uid FOR UPDATE;
  IF COALESCE(_dep,0)+COALESCE(_win,0) < _stake THEN
    RETURN jsonb_build_object('ok',false,'error','insufficient_balance');
  END IF;

  -- Debit stake (deposit first, then winnings)
  UPDATE public.balances
     SET deposit_balance = GREATEST(_dep - _stake, 0),
         winnings_balance = _win - GREATEST(_stake - _dep, 0),
         updated_at = now()
   WHERE user_id = _uid;
  INSERT INTO public.transactions(user_id,type,method,amount,status)
  VALUES (_uid,'game_entry','fx_casino',_stake,'completed');

  -- Server-decided outcome
  _outcome := random() < _wc;

  IF _outcome THEN
    _payout := round(_stake * _mult, 2);
    _profit := _payout - _stake;
    UPDATE public.balances
       SET winnings_balance = winnings_balance + _payout, updated_at = now()
     WHERE user_id = _uid;
    INSERT INTO public.transactions(user_id,type,method,amount,status)
    VALUES (_uid,'game_win','fx_casino',_payout,'completed');
  ELSE
    _profit := -_stake;
  END IF;

  -- Record into game_results (room_id is required: create a dummy completed room)
  INSERT INTO public.game_rooms(mode, entry_fee, max_players, current_players, host_id, status, prize_pool, ended_at)
  VALUES ('fx_casino', _stake, 1, 1, _uid, 'completed', _stake, now())
  RETURNING id INTO _room_id;

  INSERT INTO public.game_results(room_id, user_id, mode, entry_fee, prize_awarded, is_winner)
  VALUES (_room_id, _uid, 'fx_casino', _stake, _payout, _outcome);

  UPDATE public.profiles SET
    total_games = total_games + 1,
    total_wins = total_wins + CASE WHEN _outcome THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN _outcome THEN 0 ELSE 1 END
  WHERE id = _uid;

  RETURN jsonb_build_object(
    'ok',true,
    'won',_outcome,
    'stake',_stake,
    'payout',_payout,
    'profit',_profit,
    'direction',_direction
  );
END $$;

GRANT EXECUTE ON FUNCTION public.fx_play_bet(numeric, text) TO authenticated;
