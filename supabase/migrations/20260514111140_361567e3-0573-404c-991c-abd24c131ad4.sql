
-- App settings table for admin-configurable secrets like Twilio
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write settings (contains Twilio auth token)
CREATE POLICY "Admins manage app settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_settings_touch
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed empty Twilio row so admin form shows up
INSERT INTO public.app_settings (key, value) VALUES
  ('twilio', '{"account_sid":"","auth_token":"","verify_service_sid":"","enabled":false}'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- Phone OTP attempt log (rate limit + audit)
CREATE TABLE public.phone_otp_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_otp_attempts_phone_time
  ON public.phone_otp_attempts(phone, created_at DESC);

ALTER TABLE public.phone_otp_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view otp attempts"
  ON public.phone_otp_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
