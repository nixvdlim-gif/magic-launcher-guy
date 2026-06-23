import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transfer")({
  component: TransferPage,
});

type TransferRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount: number;
  fee_amount: number;
  recipient_received: number;
  created_at: string;
};

function TransferPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const c = useCurrency();
  const [winnings, setWinnings] = useState(0);
  const [settings, setSettings] = useState({ fee_percent: 5, min_amount: 50, max_amount: 25000, enabled: true });
  const [gameId, setGameId] = useState("");
  const [recipient, setRecipient] = useState<{ id: string; username: string; game_id: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<TransferRow[]>([]);

  const loadAll = async () => {
    if (!user) return;
    const [{ data: bal }, { data: cfg }, { data: hist }] = await Promise.all([
      supabase.from("balances").select("winnings_balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "transfer").maybeSingle(),
      supabase.from("balance_transfers").select("*").or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(20),
    ]);
    if (bal) setWinnings(Number(bal.winnings_balance) || 0);
    if (cfg?.value) setSettings({ ...settings, ...(cfg.value as object) });
    if (hist) setHistory(hist as TransferRow[]);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const findRecipient = async () => {
    if (!gameId.trim()) return;
    const { data } = await supabase.from("profiles").select("id, username, game_id").eq("game_id", gameId.trim()).maybeSingle();
    if (!data) {
      setRecipient(null);
      toast.error(t("user_not_found"));
      return;
    }
    if (data.id === user?.id) {
      setRecipient(null);
      toast.error(lang === "bn" ? "নিজের কাছে পাঠানো যাবে না" : "Cannot transfer to yourself");
      return;
    }
    setRecipient(data as { id: string; username: string; game_id: string });
  };

  const amt = Number(amount) || 0;
  const fee = +(amt * settings.fee_percent / 100).toFixed(2);
  const recv = +(amt - fee).toFixed(2);
  const canSubmit = recipient && amt >= settings.min_amount && amt <= settings.max_amount && amt <= winnings && !submitting;

  const submit = async () => {
    if (!recipient) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("transfer_balance", {
      _recipient_game_id: recipient.game_id,
      _amount: amt,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("transfer_success"));
    setAmount(""); setGameId(""); setRecipient(null);
    loadAll();
    void data;
  };

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/wallet" className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="text-xl font-bold">{t("transfer")}</h1>
      </div>

      <Card className="p-4 bg-gradient-primary text-primary-foreground">
        <div className="text-xs opacity-80">{t("winnings_balance")}</div>
        <div className="text-2xl font-extrabold">{c} {winnings.toFixed(2)}</div>
      </Card>

      <Card className="p-4 space-y-3">
        <Label>{t("recipient_game_id")}</Label>
        <div className="flex gap-2 items-stretch">
          <Input className="flex-1 min-w-0" value={gameId} onChange={(e) => setGameId(e.target.value.toUpperCase())} placeholder="ABCD1234" maxLength={12} />
          <Button onClick={findRecipient} variant="secondary" size="icon" className="h-10 w-10 shrink-0" aria-label={t("find_user")}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {recipient && (
          <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/30 flex items-center justify-center font-bold">{recipient.username[0]?.toUpperCase()}</div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{recipient.username}</div>
              <div className="text-xs text-muted-foreground truncate">ID: {recipient.game_id}</div>
            </div>
          </div>
        )}
      </Card>

      {recipient && (
        <Card className="p-4 space-y-3">
          <Label>{t("amount")}</Label>
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={`${settings.min_amount} – ${settings.max_amount}`} />
          {amt > 0 && (
            <div className="rounded-xl bg-card/60 border border-border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("amount")}</span><span>{c}{amt.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("fee")} ({settings.fee_percent}%)</span><span className="text-destructive">−{c}{fee.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>{t("recipient_gets")}</span><span className="text-primary">{c}{recv.toFixed(2)}</span></div>
            </div>
          )}
          <Button onClick={submit} disabled={!canSubmit} className="w-full h-11">
            <Send className="h-4 w-4 mr-2" />{submitting ? t("submitting") : t("send_now")}
          </Button>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-bold mb-2">{t("transfer_history")}</h2>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">{t("no_transactions")}</p>
        ) : (
          <div className="rounded-2xl bg-card border border-border divide-y divide-border">
            {history.map((h) => {
              const isOut = h.sender_id === user?.id;
              return (
                <div key={h.id} className="p-3 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isOut ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary"}`}>
                    {isOut ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{isOut ? t("sent") : t("received")}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}</div>
                  </div>
                  <div className={`text-sm font-bold ${isOut ? "text-foreground" : "text-primary"}`}>
                    {isOut ? `-${c}${Number(h.amount).toFixed(2)}` : `+${c}${Number(h.recipient_received).toFixed(2)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}