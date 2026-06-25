
CREATE TYPE public.room_status AS ENUM ('waiting','playing','finished','cancelled');

CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  mode text NOT NULL,
  entry_fee numeric NOT NULL DEFAULT 0,
  prize_pool numeric NOT NULL DEFAULT 0,
  max_players integer NOT NULL DEFAULT 2,
  current_players integer NOT NULL DEFAULT 0,
  host_id uuid NOT NULL,
  status public.room_status NOT NULL DEFAULT 'waiting',
  started_at timestamptz,
  ended_at timestamptz,
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_rooms_status ON public.game_rooms(status);
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view rooms" ON public.game_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create rooms" ON public.game_rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host or admin updates rooms" ON public.game_rooms FOR UPDATE TO authenticated
  USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete rooms" ON public.game_rooms FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rooms_touch BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.game_room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seat integer NOT NULL,
  is_bot boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id),
  UNIQUE (room_id, seat)
);
ALTER TABLE public.game_room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view seats" ON public.game_room_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users seat themselves" ON public.game_room_players FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave own seat" ON public.game_room_players FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_players;
ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.game_room_players REPLICA IDENTITY FULL;

CREATE TABLE public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avatar_url text,
  skill_level integer NOT NULL DEFAULT 5 CHECK (skill_level BETWEEN 1 AND 10),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active bots" ON public.bots FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage bots" ON public.bots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bots_touch BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  whatsapp text,
  area text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active agents" ON public.agents FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage agents" ON public.agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_agents_touch BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
