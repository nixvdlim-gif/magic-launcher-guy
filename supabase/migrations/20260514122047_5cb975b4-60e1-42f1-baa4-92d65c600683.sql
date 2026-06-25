
-- ========== EMOJI SHOP ==========
CREATE TABLE public.emoji_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.emoji_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active categories" ON public.emoji_categories FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage emoji categories" ON public.emoji_categories FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.emoji_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.emoji_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_bn text,
  emoji_char text,                 -- a unicode char OR
  image_url text,                  -- file URL
  price numeric NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  use_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.emoji_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed view active emoji items" ON public.emoji_items FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage emoji items" ON public.emoji_items FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.emoji_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  emoji_id uuid NOT NULL REFERENCES public.emoji_items(id) ON DELETE CASCADE,
  amount_paid numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, emoji_id)
);
ALTER TABLE public.emoji_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own emoji purchases" ON public.emoji_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage purchases" ON public.emoji_purchases FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.purchase_emoji(_emoji_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item record;
  v_win numeric;
  v_dep numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_item FROM public.emoji_items WHERE id = _emoji_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emoji not available'; END IF;
  IF EXISTS (SELECT 1 FROM public.emoji_purchases WHERE user_id = v_user AND emoji_id = _emoji_id) THEN
    RAISE EXCEPTION 'Already owned';
  END IF;
  IF v_item.price > 0 THEN
    SELECT winnings_balance, deposit_balance INTO v_win, v_dep FROM public.balances WHERE user_id = v_user FOR UPDATE;
    IF (COALESCE(v_win,0) + COALESCE(v_dep,0)) < v_item.price THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    IF v_win >= v_item.price THEN
      UPDATE public.balances SET winnings_balance = winnings_balance - v_item.price, updated_at = now() WHERE user_id = v_user;
    ELSE
      UPDATE public.balances SET winnings_balance = 0, deposit_balance = deposit_balance - (v_item.price - v_win), updated_at = now() WHERE user_id = v_user;
    END IF;
  END IF;
  INSERT INTO public.emoji_purchases (user_id, emoji_id, amount_paid) VALUES (v_user, _emoji_id, v_item.price);
  IF v_item.price > 0 THEN
    INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, reference)
      VALUES (v_user, 'game_entry', 'system', v_item.price, 'approved', now(), 'emoji:' || _emoji_id::text);
  END IF;
  RETURN jsonb_build_object('owned', true, 'price', v_item.price);
END $$;

-- ========== GLOBAL CHAT ==========
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_idx ON public.chat_messages (created_at DESC);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed view chat" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage chat" ON public.chat_messages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Insert via SECURITY DEFINER function (rate limit + length check)
CREATE OR REPLACE FUNCTION public.send_chat_message(_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_recent int;
  v_id uuid;
  v_clean text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clean := btrim(_body);
  IF length(v_clean) < 1 THEN RAISE EXCEPTION 'Empty message'; END IF;
  IF length(v_clean) > 300 THEN RAISE EXCEPTION 'Message too long (max 300)'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND is_blocked = true) THEN
    RAISE EXCEPTION 'You are blocked';
  END IF;
  SELECT count(*) INTO v_recent FROM public.chat_messages
    WHERE user_id = v_user AND created_at > now() - interval '2 seconds';
  IF v_recent > 0 THEN RAISE EXCEPTION 'Too fast — wait a moment'; END IF;
  INSERT INTO public.chat_messages (user_id, body) VALUES (v_user, v_clean) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
