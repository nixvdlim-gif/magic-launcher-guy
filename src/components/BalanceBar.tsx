import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";

export function BalanceBar() {
  const c = useCurrency();
  const { user } = useAuth();
  const { lang } = useI18n();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("balances")
        .select("deposit_balance, winnings_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setTotal((Number(data.deposit_balance) || 0) + (Number(data.winnings_balance) || 0));
    };
    load();
    const ch = supabase
      .channel("bal_bar_" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balances", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <div className="rounded-2xl border-2 border-gold/50 bg-gradient-to-r from-primary/20 to-accent/20 px-4 py-2.5 flex items-center justify-between shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-gold" />
        <span className="text-[11px] text-white/70">{lang === "bn" ? "ব্যালেন্স" : "Balance"}</span>
      </div>
      <div className="font-black text-lg text-gold" style={{ fontFamily: "var(--font-display)" }}>
        {c} {total.toFixed(2)}
      </div>
    </div>
  );
}
