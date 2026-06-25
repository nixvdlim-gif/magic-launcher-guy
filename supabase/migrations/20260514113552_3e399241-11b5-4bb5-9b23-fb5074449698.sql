CREATE TYPE public.notification_type AS ENUM (
  'deposit_approved', 'deposit_rejected',
  'withdraw_approved', 'withdraw_rejected',
  'transfer_received', 'referral_bonus',
  'announcement', 'system'
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Support tickets
CREATE TYPE public.ticket_status AS ENUM ('open', 'pending', 'resolved', 'closed');

CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status public.ticket_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_user ON public.support_tickets(user_id, created_at DESC);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tickets_updated
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msgs_ticket ON public.support_messages(ticket_id, created_at);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ticket messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "Users send to own tickets" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_admin = false
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admins manage support messages" ON public.support_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Notification trigger on transaction status change
CREATE OR REPLACE FUNCTION public.notify_on_txn_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title TEXT;
  v_type public.notification_type;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.type = 'deposit' AND NEW.status = 'approved' THEN
    v_type := 'deposit_approved'; v_title := 'Deposit approved — ৳' || NEW.amount;
  ELSIF NEW.type = 'deposit' AND NEW.status = 'rejected' THEN
    v_type := 'deposit_rejected'; v_title := 'Deposit rejected — ৳' || NEW.amount;
  ELSIF NEW.type = 'withdraw' AND NEW.status = 'approved' THEN
    v_type := 'withdraw_approved'; v_title := 'Withdraw approved — ৳' || NEW.amount;
  ELSIF NEW.type = 'withdraw' AND NEW.status = 'rejected' THEN
    v_type := 'withdraw_rejected'; v_title := 'Withdraw rejected — ৳' || NEW.amount;
  ELSIF NEW.type = 'transfer_in' AND NEW.status = 'approved' THEN
    v_type := 'transfer_received'; v_title := 'Received ৳' || NEW.amount;
  ELSIF NEW.type = 'referral_bonus' AND NEW.status = 'approved' THEN
    v_type := 'referral_bonus'; v_title := 'Referral bonus +৳' || NEW.amount;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.user_id, v_type, v_title, COALESCE(NEW.admin_note, ''), '/transactions');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_txn
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_txn_status();