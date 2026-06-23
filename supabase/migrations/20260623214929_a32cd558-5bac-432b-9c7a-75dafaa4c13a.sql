ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS bots_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS banner_url text;