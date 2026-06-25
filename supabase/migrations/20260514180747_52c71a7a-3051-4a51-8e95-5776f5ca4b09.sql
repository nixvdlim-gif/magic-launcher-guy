INSERT INTO public.app_settings (key, value)
VALUES (
  'game_modes',
  jsonb_build_object(
    'classic', jsonb_build_object('enabled', true, 'p2', true, 'p4', true),
    'speed',   jsonb_build_object('enabled', true, 'p2', true, 'p4', true),
    'quick',   jsonb_build_object('enabled', true, 'p2', true, 'p4', true),
    'time',    jsonb_build_object('enabled', true, 'p2', true, 'p4', true)
  )
)
ON CONFLICT (key) DO NOTHING;