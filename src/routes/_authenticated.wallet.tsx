import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type DictKey } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, ArrowDownToLine, ArrowUpRight, ArrowDownLeft, Send, History, UserCheck, RefreshCw } from "lucide-react";
import { PaymentDialog } from "@/components/PaymentDialog";
import { verifyFincraDeposit } from "@/lib/fincra.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

type Txn = {
  id: string;
  type: "deposit" | "withdraw" | "game_entry" | "game_win" | "refund" | "referral_bonus" | "admin_adjust";
  method: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  external_txn_id: string | null;
  created_at: string;
};

function WalletPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const c = useCurrency();
  const [bal, setBal] = useState({ deposit: 0, winnings: 0 });
  const [txns, setTxns] = useState<Txn[]>([]);
  const [openDeposit, setOpenDeposit] = useState(false);
  const [openWithdraw, setOpenWithdraw] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: b }, { data: list }] = await Promise.all([
      supabase.from("balances").select("deposit_balance, winnings_balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("transactions").select("id,type,method,amount,status,external_txn_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (b) setBal({ deposit: Number(b.deposit_balance) || 0, winnings: Number(b.winnings_balance) || 0 });
    if (list) setTxns(list as Txn[]);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const verifyFn = useServerFn(verifyFincraDeposit);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const verifyOne = useCallback(async (reference: string, txnId: string) => {
    setVerifyingId(txnId);
    try {
      const r = await verifyFn({ data: { reference } });
      if (r.ok && (r.status === "approved" || r.status === "already")) {
        toast.success(r.status === "approved" ? "Payment confirmed — balance credited" : "Already credited");
        await refresh();
      } else if (r.status === "pending") {
        toast.info("Still pending at gateway. Try again in a moment.");
      } else if (r.status === "amount_mismatch") {
        toast.error("Amount mismatch — transaction rejected.");
        await refresh();
      } else {
        toast.error(`Could not verify (${r.status})`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  }, [verifyFn, refresh]);

  // Auto-verify on return from Fincra checkout (?fn_ref=...)
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current || !user) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("fn_ref");
    if (!ref) return;
    autoTried.current = true;
    (async () => {
      // Try a few times — Fincra may take a couple seconds to settle
      for (let i = 0; i < 4; i++) {
        try {
          const r = await verifyFn({ data: { reference: ref } });
          if (r.ok && (r.status === "approved" || r.status === "already")) {
            toast.success("Payment confirmed — balance credited");
            await refresh();
            break;
          }
          if (r.status === "amount_mismatch") {
            toast.error("Amount mismatch — please contact support.");
            await refresh();
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("fn_ref");
      window.history.replaceState(null, "", url.toString());
    })();
  }, [user, verifyFn, refresh]);

  const total = bal.deposit + bal.winnings;


  return (
    <div className="px-4 pt-6 space-y-5">
      <h1 className="text-2xl font-bold">{t("wallet")}</h1>

      <div className="rounded-3xl p-5 bg-gradient-primary shadow-glow text-primary-foreground relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-2 text-xs opacity-90"><Wallet className="h-4 w-4" />{t("total_balance")}</div>
        <div className="text-3xl font-extrabold mt-1">{c} {total.toFixed(2)}</div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
          <div className="rounded-xl bg-white/10 p-2.5">
            <div className="opacity-80">{t("deposit_balance")}</div>
            <div className="font-bold text-base">{c} {bal.deposit.toFixed(2)}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5">
            <div className="opacity-80">{t("winnings_balance")}</div>
            <div className="font-bold text-base">{c} {bal.winnings.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button className="h-12 shadow-glow" onClick={() => setOpenDeposit(true)}><Plus className="h-4 w-4 mr-1" />{t("add_cash")}</Button>
        <Button variant="secondary" className="h-12" onClick={() => setOpenWithdraw(true)}><ArrowDownToLine className="h-4 w-4 mr-1" />{t("withdraw")}</Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button asChild variant="outline" className="h-11 px-2"><Link to="/transfer" className="min-w-0"><Send className="h-4 w-4 mr-1 shrink-0" /><span className="truncate text-xs">{t("transfer")}</span></Link></Button>
        <Button asChild variant="outline" className="h-11 px-2"><Link to="/transactions" className="min-w-0"><History className="h-4 w-4 mr-1 shrink-0" /><span className="truncate text-xs">{lang === "bn" ? "লেনদেন" : "Txns"}</span></Link></Button>
        <Button asChild variant="outline" className="h-11 px-2"><Link to="/agents" className="min-w-0"><UserCheck className="h-4 w-4 mr-1 shrink-0" /><span className="truncate text-xs">{lang === "bn" ? "এজেন্ট" : "Agents"}</span></Link></Button>
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <h2 className="text-sm font-bold mb-3">{t("history")}</h2>
        {txns.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("no_transactions")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {txns.map((tx) => {
              const isCredit = tx.type === "deposit" || tx.type === "game_win" || tx.type === "refund" || tx.type === "referral_bonus";
              const typeKey = ("type_" + tx.type) as DictKey;
              const statusKey = tx.status as DictKey;
              return (
                <li key={tx.id} className="py-2.5 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isCredit ? "bg-primary/15 text-primary" : "bg-accent/20 text-accent"}`}>
                    {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t(typeKey)} <span className="text-[10px] text-muted-foreground uppercase">· {tx.method}</span></div>
                    <div className="text-[11px] text-muted-foreground">{new Date(tx.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${isCredit ? "text-primary" : "text-foreground"}`}>{isCredit ? "+" : "-"}{c}{Number(tx.amount).toFixed(2)}</div>
                    <div className={`text-[10px] inline-block px-1.5 py-0.5 rounded mt-0.5 ${
                      tx.status === "approved" || tx.status === "completed" ? "bg-primary/15 text-primary"
                      : tx.status === "rejected" || tx.status === "cancelled" ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground"
                    }`}>{t(statusKey)}</div>
                    {tx.status === "pending" && tx.method === "fincra" && tx.external_txn_id && (
                      <button
                        type="button"
                        onClick={() => verifyOne(tx.external_txn_id!, tx.id)}
                        disabled={verifyingId === tx.id}
                        className="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${verifyingId === tx.id ? "animate-spin" : ""}`} />
                        {verifyingId === tx.id ? "Checking…" : "Verify"}
                      </button>
                    )}
                  </div>

                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PaymentDialog open={openDeposit} onOpenChange={setOpenDeposit} mode="deposit" onSuccess={refresh} />
      <PaymentDialog open={openWithdraw} onOpenChange={setOpenWithdraw} mode="withdraw" availableBalance={total} onSuccess={refresh} />
    </div>
  );
}