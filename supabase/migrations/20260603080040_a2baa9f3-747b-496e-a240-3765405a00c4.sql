
-- 1) profiles.phone column-level: hide from anon & authenticated
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;

-- 2) agents: restrict to authenticated
DROP POLICY IF EXISTS ag_read ON public.agents;
CREATE POLICY ag_read_auth ON public.agents FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.agents FROM anon;

-- 3) coupons: admin-only read (redemption uses SECURITY DEFINER RPC)
DROP POLICY IF EXISTS cp_read_active ON public.coupons;
REVOKE SELECT ON public.coupons FROM anon, authenticated;

-- 4) payment_settings: authenticated only
DROP POLICY IF EXISTS ps_read ON public.payment_settings;
CREATE POLICY ps_read_auth ON public.payment_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.payment_settings FROM anon;

-- 5) game_rooms: authenticated only
DROP POLICY IF EXISTS rooms_read ON public.game_rooms;
CREATE POLICY rooms_read_auth ON public.game_rooms FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.game_rooms FROM anon;

-- 6) Revoke EXECUTE on all public SECURITY DEFINER functions from anon
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
                   r.schema, r.name, r.args);
  END LOOP;
END $$;
