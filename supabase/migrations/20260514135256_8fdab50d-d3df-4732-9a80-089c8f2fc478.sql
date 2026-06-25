-- Add helper to read cron secret (admin or service role only via SECURITY DEFINER + explicit check)
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can read via PostgREST; service-role bypasses RLS so server route works
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN (SELECT value->>'cron_secret' FROM public.app_settings WHERE key = 'security');
END $$;

-- Seed an empty security settings row if missing
INSERT INTO public.app_settings (key, value)
VALUES ('security', '{"cron_secret": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;