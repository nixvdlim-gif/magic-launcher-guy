
ALTER TABLE public.coupons ADD COLUMN description text;
ALTER TABLE public.kyc_submissions ADD COLUMN admin_note text;
ALTER TABLE public.game_rooms ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER trg_game_rooms_updated BEFORE UPDATE ON public.game_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
