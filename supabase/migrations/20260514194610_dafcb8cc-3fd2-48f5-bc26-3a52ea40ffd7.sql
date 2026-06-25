DROP POLICY IF EXISTS "Authed read game_modes" ON public.app_settings;

CREATE POLICY "Authed read public settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key IN ('game_modes', 'theme'));