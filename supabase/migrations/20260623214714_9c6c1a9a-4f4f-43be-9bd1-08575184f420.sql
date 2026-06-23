-- Default commission + level-gate settings
INSERT INTO public.app_settings (key, value)
VALUES (
  'game',
  jsonb_build_object(
    'commission_percent', 10,
    'level_gates', jsonb_build_array(
      jsonb_build_object('min_entry', 0,    'min_level', 1),
      jsonb_build_object('min_entry', 100,  'min_level', 2),
      jsonb_build_object('min_entry', 250,  'min_level', 4),
      jsonb_build_object('min_entry', 500,  'min_level', 6)
    )
  )
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_level_gate(_entry_fee numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_level int; v_settings jsonb; v_required int := 1; v_gate jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT level INTO v_level FROM public.profiles WHERE id = v_user;
  SELECT value INTO v_settings FROM public.app_settings WHERE key = 'game';
  IF v_settings IS NOT NULL THEN
    FOR v_gate IN SELECT * FROM jsonb_array_elements(v_settings->'level_gates') LOOP
      IF _entry_fee >= (v_gate->>'min_entry')::numeric THEN
        v_required := GREATEST(v_required, (v_gate->>'min_level')::int);
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('allowed', COALESCE(v_level,1) >= v_required, 'user_level', COALESCE(v_level,1), 'required_level', v_required);
END $$;

-- Phone privacy
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, username, avatar_url, level, total_wins, total_losses, total_games, game_id, is_verified, is_blocked, language, referred_by, created_at, updated_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_phone() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT phone FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.admin_get_phone(_uid uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN (SELECT phone FROM public.profiles WHERE id = _uid);
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_phone(uuid) TO authenticated;

-- Commission ledger
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  mode text NOT NULL,
  pot_amount numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  player_count int NOT NULL DEFAULT 0,
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_ledger TO authenticated;
GRANT ALL ON public.commission_ledger TO service_role;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view commission" ON public.commission_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_commission_created ON public.commission_ledger(created_at DESC);

-- Refunds
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL DEFAULT 'room_cancelled',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view refunds" ON public.refunds FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own refunds" ON public.refunds FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Tournament matches
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  round int NOT NULL,
  match_no int NOT NULL,
  player1_id uuid,
  player2_id uuid,
  winner_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, round, match_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_matches TO authenticated;
GRANT ALL ON public.tournament_matches TO service_role;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view matches" ON public.tournament_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage matches" ON public.tournament_matches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_tm_tournament ON public.tournament_matches(tournament_id, round);

-- is_bot on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;
GRANT SELECT (is_bot) ON public.profiles TO authenticated;

-- game_rooms extra columns referenced by app
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS state jsonb;
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS current_turn int;

-- Add 'fincra' to payment_method enum if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'fincra' AND enumtypid = 'public.payment_method'::regtype) THEN
    ALTER TYPE public.payment_method ADD VALUE 'fincra';
  END IF;
END $$;