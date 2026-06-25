
CREATE TYPE public.tournament_status AS ENUM ('upcoming','live','completed','cancelled');

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  banner_url text,
  entry_fee numeric NOT NULL DEFAULT 0,
  prize_pool numeric NOT NULL DEFAULT 0,
  max_players integer NOT NULL DEFAULT 16,
  start_at timestamptz NOT NULL,
  status public.tournament_status NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view tournaments" ON public.tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tournaments" ON public.tournaments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tournaments_touch BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  placement integer,
  prize_won numeric NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own entries" ON public.tournament_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users join tournaments" ON public.tournament_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage entries" ON public.tournament_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  mode text NOT NULL,
  entry_fee numeric NOT NULL DEFAULT 0,
  prize_awarded numeric NOT NULL DEFAULT 0,
  winner_id uuid,
  player_ids uuid[] NOT NULL DEFAULT '{}',
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_results_winner ON public.game_results(winner_id);
CREATE INDEX idx_game_results_players ON public.game_results USING gin(player_ids);
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own games" ON public.game_results FOR SELECT TO authenticated
  USING (auth.uid() = winner_id OR auth.uid() = ANY(player_ids) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage game results" ON public.game_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
