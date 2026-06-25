-- Create kyc-docs storage bucket (private) with policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own KYC files (folder = their user id)
CREATE POLICY "kyc_own_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kyc_own_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "kyc_admin_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'kyc-docs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'kyc-docs' AND public.has_role(auth.uid(), 'admin'));