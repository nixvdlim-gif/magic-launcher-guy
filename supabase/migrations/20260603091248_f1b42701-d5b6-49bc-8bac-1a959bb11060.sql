
-- 1) Recreate admin_list_users to include balances
DROP FUNCTION IF EXISTS public.admin_list_users(text, integer);

CREATE OR REPLACE FUNCTION public.admin_list_users(_q text DEFAULT NULL::text, _limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, email text, username text, game_id text, phone text, created_at timestamp with time zone,
               total_wins integer, total_losses integer, total_games integer, level integer,
               is_blocked boolean, is_verified boolean, roles text[],
               deposit_balance numeric, winnings_balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, u.email::text, p.username, p.game_id, u.phone::text, p.created_at,
         p.total_wins, p.total_losses, p.total_games, p.level, p.is_blocked, p.is_verified,
         COALESCE(ARRAY(SELECT role::text FROM public.user_roles WHERE user_id=p.id), ARRAY[]::text[]),
         COALESCE(b.deposit_balance, 0), COALESCE(b.winnings_balance, 0)
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.balances b ON b.user_id = p.id
  WHERE _q IS NULL
     OR p.username ILIKE '%'||_q||'%'
     OR p.game_id ILIKE '%'||_q||'%'
     OR u.email ILIKE '%'||_q||'%'
     OR u.phone ILIKE '%'||_q||'%'
  ORDER BY p.created_at DESC LIMIT _limit;
END $function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer) TO authenticated;

-- 2) Admin balance adjustment (positive or negative amount; kind = deposit|winnings)
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _kind text, _amount numeric, _note text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _dep numeric; _win numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;
  IF _kind NOT IN ('deposit','winnings') THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_kind');
  END IF;
  IF _amount IS NULL OR _amount = 0 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_amount');
  END IF;

  INSERT INTO public.balances(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  SELECT deposit_balance, winnings_balance INTO _dep, _win
    FROM public.balances WHERE user_id=_user_id FOR UPDATE;

  IF _kind = 'deposit' THEN
    IF COALESCE(_dep,0) + _amount < 0 THEN
      RETURN jsonb_build_object('ok',false,'error','insufficient_balance');
    END IF;
    UPDATE public.balances SET deposit_balance = deposit_balance + _amount, updated_at=now()
      WHERE user_id=_user_id;
  ELSE
    IF COALESCE(_win,0) + _amount < 0 THEN
      RETURN jsonb_build_object('ok',false,'error','insufficient_balance');
    END IF;
    UPDATE public.balances SET winnings_balance = winnings_balance + _amount, updated_at=now()
      WHERE user_id=_user_id;
  END IF;

  INSERT INTO public.transactions(user_id, type, method, amount, status, admin_note)
  VALUES (_user_id, 'admin_adjust', _kind, _amount, 'completed', _note);

  RETURN jsonb_build_object('ok',true);
END $function$;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text) TO authenticated;

-- 3) Admin update user settings (username/verified/blocked/admin role)
CREATE OR REPLACE FUNCTION public.admin_update_user(
  _user_id uuid,
  _username text DEFAULT NULL,
  _is_verified boolean DEFAULT NULL,
  _is_blocked boolean DEFAULT NULL,
  _is_admin boolean DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'error','forbidden');
  END IF;

  UPDATE public.profiles SET
    username    = COALESCE(NULLIF(trim(_username),''), username),
    is_verified = COALESCE(_is_verified, is_verified),
    is_blocked  = COALESCE(_is_blocked, is_blocked),
    updated_at  = now()
  WHERE id = _user_id;

  IF _is_admin IS TRUE THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, 'admin')
      ON CONFLICT DO NOTHING;
  ELSIF _is_admin IS FALSE THEN
    DELETE FROM public.user_roles WHERE user_id=_user_id AND role='admin';
  END IF;

  RETURN jsonb_build_object('ok',true);
END $function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean, boolean, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean, boolean, boolean) TO authenticated;
