
-- Remove direct INSERT on balance_transfers (handled by transfer_balance RPC)
DROP POLICY IF EXISTS bt_insert ON public.balance_transfers;

-- Remove direct INSERT on emoji_purchases (handled by purchase_emoji RPC)
DROP POLICY IF EXISTS ep_insert_own ON public.emoji_purchases;

-- Restrict profiles SELECT to authenticated users only
DROP POLICY IF EXISTS profiles_read_all ON public.profiles;
CREATE POLICY profiles_read_auth ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Remove obsolete quickteller credentials from app_settings (replaced by Fincra secrets)
DELETE FROM public.app_settings WHERE key = 'quickteller';
