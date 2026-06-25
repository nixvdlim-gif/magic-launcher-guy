
CREATE OR REPLACE FUNCTION public.send_notification(
  _user_id uuid,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL,
  _type notification_type DEFAULT 'system'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_user_id, _title, _body, _link, _type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_notification(
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL,
  _type notification_type DEFAULT 'system'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  SELECT id, _title, _body, _link, _type FROM public.profiles
  WHERE is_blocked = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text, notification_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.broadcast_notification(text, text, text, notification_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, notification_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(text, text, text, notification_type) TO authenticated;

-- Enable realtime for the notifications table so subscribers receive INSERTs
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;
