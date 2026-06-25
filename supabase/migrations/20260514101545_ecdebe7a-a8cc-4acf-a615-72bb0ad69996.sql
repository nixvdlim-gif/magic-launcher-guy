
-- Fix search_path on touch_updated_at + generate_game_id (others already had it)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_game_id()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    new_id := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE game_id = new_id);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique Game ID';
    END IF;
  END LOOP;
  RETURN new_id;
END;
$$;

-- Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_game_id() FROM PUBLIC, anon, authenticated;
-- has_role() must remain callable by authenticated users (used in RLS) — leave default
