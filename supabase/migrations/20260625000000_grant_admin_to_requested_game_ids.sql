INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE p.game_id IN ('350538', '721521')
ON CONFLICT (user_id, role) DO NOTHING;
