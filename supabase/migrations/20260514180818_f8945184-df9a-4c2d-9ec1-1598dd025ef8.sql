CREATE POLICY "Authed read game_modes"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key = 'game_modes');