import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ArrowDownToLine } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PaymentDialog } from "@/components/PaymentDialog";

export const Route = createFileRoute("/_authenticated/withdraw")({
  component: WithdrawPage,
});

function WithdrawPage() {
  const { lang } = useI18n();
  const c = useCurrency();
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(true);
  const [bal, setBal] = useState({ deposit: 0, winnings: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from("balances").select("deposit_balance, winnings_balance").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data && setBal({ deposit: Number(data.deposit_balance) || 0, winnings: Number(data.winnings_balance) || 0 }));
  }, [user]);

  const total = bal.deposit + bal.winnings;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/wallet" })} className="h-9 w-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{lang === "bn" ? "উইথড্র করুন" : "Withdraw"}</h1>
      </div>

      <div className="rounded-2xl p-4 bg-gradient-secondary text-secondary-foreground shadow-glow-violet">
        <div className="flex items-center gap-2 text-xs opacity-90"><ArrowDownToLine className="h-4 w-4" />{lang === "bn" ? "উইনিংস ব্যালেন্স" : "Winnings Balance"}</div>
        <div className="text-2xl font-extrabold mt-1">{c} {bal.winnings.toFixed(2)}</div>
        <div className="text-[11px] opacity-80 mt-1">
          {lang === "bn" ? "শুধু উইনিংস উইথড্র করা যাবে" : "Only winnings can be withdrawn"}
        </div>
      </div>

      <PaymentDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) nav({ to: "/wallet" }); }} mode="withdraw" availableBalance={total} onSuccess={() => nav({ to: "/wallet" })} />
    </div>
  );
}