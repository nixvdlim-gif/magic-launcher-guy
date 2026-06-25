
-- Lock down phone column on profiles: only owner (via get_my_phone) and admin (via admin_list_users / admin_get_phone) can see it
REVOKE SELECT (phone) ON public.profiles FROM authenticated, anon;

-- Admin-only RPC to list users with phone + balances + search
CREATE OR REPLACE FUNCTION public.admin_list_users(_q text DEFAULT NULL, _limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  username text,
  game_id text,
  phone text,
  is_blocked boolean,
  total_wins int,
  total_games int,
  created_at timestamptz,
  deposit_balance numeric,
  winnings_balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.game_id, p.phone, p.is_blocked,
         p.total_wins, p.total_games, p.created_at,
         COALESCE(b.deposit_balance, 0), COALESCE(b.winnings_balance, 0)
  FROM public.profiles p
  LEFT JOIN public.balances b ON b.user_id = p.id
  WHERE _q IS NULL OR _q = ''
     OR p.username ILIKE '%' || _q || '%'
     OR p.game_id  ILIKE '%' || _q || '%'
     OR p.phone    ILIKE '%' || _q || '%'
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END $$;
