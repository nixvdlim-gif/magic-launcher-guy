-- Ensure the private KYC documents bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Rebuild KYC submission policies with explicit authenticated access
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_own" ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_insert_own" ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_update_own_admin" ON public.kyc_submissions;
DROP POLICY IF EXISTS "kyc_admin" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users view own kyc" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Users submit kyc" ON public.kyc_submissions;
DROP POLICY IF EXISTS "Admins manage kyc" ON public.kyc_submissions;

CREATE POLICY "Users can view their own KYC submissions"
ON public.kyc_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can submit their own KYC"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rejected KYC"
ON public.kyc_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'rejected')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage KYC submissions"
ON public.kyc_submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rebuild KYC storage policies with explicit authenticated access
DROP POLICY IF EXISTS "kyc_own_upload" ON storage.objects;
DROP POLICY IF EXISTS "kyc_own_read" ON storage.objects;
DROP POLICY IF EXISTS "kyc_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own kyc docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own kyc docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage kyc docs" ON storage.objects;

CREATE POLICY "Users can upload own kyc docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own kyc docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own kyc docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can manage kyc docs"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'kyc-docs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'kyc-docs' AND public.has_role(auth.uid(), 'admin'));

-- Keep currency/app settings readable to the app but writable only by admins
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "as_read" ON public.app_settings;
DROP POLICY IF EXISTS "as_admin" ON public.app_settings;

CREATE POLICY "App settings are readable"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage app settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
