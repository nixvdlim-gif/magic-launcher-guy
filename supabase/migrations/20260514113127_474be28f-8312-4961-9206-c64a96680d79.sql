CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view active banners"
ON public.banners FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage banners"
ON public.banners FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_banners_updated
BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default app_settings rows so admin UI has values to edit
INSERT INTO public.app_settings (key, value) VALUES
  ('transfer', jsonb_build_object('enabled', true, 'fee_percent', 5, 'min_amount', 50, 'max_amount', 25000)),
  ('referral', jsonb_build_object('enabled', true, 'min_deposit', 100, 'l1_percent', 5, 'l2_percent', 2, 'l3_percent', 1))
ON CONFLICT (key) DO NOTHING;