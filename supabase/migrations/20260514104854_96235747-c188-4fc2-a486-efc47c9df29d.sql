
-- Trigger: when transaction status changes to approved, update balance
CREATE OR REPLACE FUNCTION public.handle_transaction_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_deposit NUMERIC;
  current_winnings NUMERIC;
BEGIN
  -- Only act on transition to 'approved'
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    SELECT deposit_balance, winnings_balance
      INTO current_deposit, current_winnings
      FROM public.balances WHERE user_id = NEW.user_id FOR UPDATE;

    IF NEW.type = 'deposit' THEN
      UPDATE public.balances
        SET deposit_balance = deposit_balance + NEW.amount, updated_at = now()
        WHERE user_id = NEW.user_id;

    ELSIF NEW.type = 'withdraw' THEN
      IF current_deposit < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient deposit balance for withdrawal';
      END IF;
      UPDATE public.balances
        SET deposit_balance = deposit_balance - NEW.amount, updated_at = now()
        WHERE user_id = NEW.user_id;

    ELSIF NEW.type = 'prize' THEN
      UPDATE public.balances
        SET winnings_balance = winnings_balance + NEW.amount, updated_at = now()
        WHERE user_id = NEW.user_id;

    ELSIF NEW.type = 'game_entry' THEN
      -- Deduct from winnings first, then deposit
      IF current_winnings >= NEW.amount THEN
        UPDATE public.balances
          SET winnings_balance = winnings_balance - NEW.amount, updated_at = now()
          WHERE user_id = NEW.user_id;
      ELSE
        IF (current_winnings + current_deposit) < NEW.amount THEN
          RAISE EXCEPTION 'Insufficient balance for game entry';
        END IF;
        UPDATE public.balances
          SET winnings_balance = 0,
              deposit_balance = deposit_balance - (NEW.amount - current_winnings),
              updated_at = now()
          WHERE user_id = NEW.user_id;
      END IF;
    END IF;

    NEW.processed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_status ON public.transactions;
CREATE TRIGGER trg_transaction_status
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_status();

-- Allow admins to UPDATE transactions (needed for approve/reject)
-- Already covered by "Admins manage transactions" ALL policy, but ensure it exists

-- Function: claim first admin if none exists
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  admin_count INT;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count > 0 THEN
    RETURN 'admin_exists';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (caller_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

  RETURN 'granted';
END;
$$;

-- Add policy: admins can view all profiles already covered by "Admins manage profiles"
-- Add policy: admins can view all balances already covered by "Admins manage balances"
-- Add policy: admins can view all roles
CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Seed default payment settings if empty
INSERT INTO public.payment_settings (method, display_name, color, icon, sort_order, min_deposit, max_deposit, min_withdraw, max_withdraw, instructions)
SELECT 'bkash'::payment_method, 'bKash', '#E2136E', 'smartphone', 1, 50, 25000, 100, 25000, 'Send Money করুন এই নাম্বারে, তারপর TrxID দিন।'
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE method = 'bkash');

INSERT INTO public.payment_settings (method, display_name, color, icon, sort_order, min_deposit, max_deposit, min_withdraw, max_withdraw, instructions)
SELECT 'nagad'::payment_method, 'Nagad', '#EC1C24', 'smartphone', 2, 50, 25000, 100, 25000, 'Send Money করুন এই নাম্বারে, তারপর TrxID দিন।'
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE method = 'nagad');

INSERT INTO public.payment_settings (method, display_name, color, icon, sort_order, min_deposit, max_deposit, min_withdraw, max_withdraw, instructions)
SELECT 'rocket'::payment_method, 'Rocket', '#8E2D8B', 'smartphone', 3, 50, 25000, 100, 25000, 'Send Money করুন এই নাম্বারে, তারপর TrxID দিন।'
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE method = 'rocket');

INSERT INTO public.payment_settings (method, display_name, color, icon, sort_order, min_deposit, max_deposit, min_withdraw, max_withdraw, instructions)
SELECT 'bank'::payment_method, 'Bank Transfer', '#0F9D58', 'building-2', 4, 500, 100000, 500, 100000, 'Bank account number দিন withdraw এর জন্য।'
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE method = 'bank');
