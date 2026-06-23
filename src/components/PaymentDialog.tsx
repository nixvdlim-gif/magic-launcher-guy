import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Copy, Zap } from "lucide-react";
import { getFincraPublicStatus, initFincraDeposit } from "@/lib/fincra.functions";

type Mode = "deposit" | "withdraw";
type Method = "bkash" | "nagad" | "rocket" | "bank" | "fincra";

type Setting = {
  id: string;
  method: Method;
  display_name: string;
  receive_number: string | null;
  instructions: string | null;
  min_deposit: number;
  max_deposit: number;
  min_withdraw: number;
  max_withdraw: number;
  deposit_enabled: boolean;
  withdraw_enabled: boolean;
  icon: string | null;
  color: string | null;
  sort_order: number;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: Mode;
  availableBalance?: number;
  onSuccess?: () => void;
};

export function PaymentDialog({ open, onOpenChange, mode, availableBalance = 0, onSuccess }: Props) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const cur = useCurrency();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [method, setMethod] = useState<Method>("bkash");
  const [amount, setAmount] = useState("");
  const [sender, setSender] = useState("");
  const [trxId, setTrxId] = useState("");
  const [accName, setAccName] = useState("");
  const [accNumber, setAccNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fincraEnabled, setFincraEnabled] = useState(false);
  const statusFn = useServerFn(getFincraPublicStatus);
  const initFincra = useServerFn(initFincraDeposit);

  useEffect(() => {
    if (!open) return;
    supabase.from("payment_settings").select("*").order("sort_order").then(({ data }) => {
      if (data) setSettings(data as Setting[]);
    });
    setAmount(""); setSender(""); setTrxId(""); setAccName(""); setAccNumber(""); setBankName("");
    if (mode === "deposit") {
      statusFn().then((s) => setFincraEnabled(!!s?.enabled)).catch(() => setFincraEnabled(false));
    } else {
      setFincraEnabled(false);
    }
  }, [open, mode, statusFn]);

  const active = settings.find((s) => s.method === method);
  const enabledList = settings.filter((s) => (mode === "deposit" ? s.deposit_enabled : s.withdraw_enabled));
  const min = active ? (mode === "deposit" ? active.min_deposit : active.min_withdraw) : 0;
  const max = active ? (mode === "deposit" ? active.max_deposit : active.max_withdraw) : 0;

  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v);
    toast.success(t("copied"));
  };

  const submit = async () => {
    if (!user) return;
    if (method === "fincra" && mode === "deposit") {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        toast.error(lang === "bn" ? "সঠিক পরিমাণ দিন।" : "Enter a valid amount.");
        return;
      }
      setSubmitting(true);
      try {
        const r = await initFincra({ data: { amount: amt } });
        if (r?.checkout_url) {
          window.location.href = r.checkout_url;
          return;
        }
        toast.error("Could not start checkout");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start checkout");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!active) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt < min || amt > max) {
      toast.error(t("min_max_amount").replace("{min}", String(min)).replace("{max}", String(max)));
      return;
    }
    if (mode === "withdraw" && amt > availableBalance) {
      toast.error(t("withdraw_balance_low"));
      return;
    }
    if (mode === "deposit") {
      if (method !== "bank" && (!sender.trim() || !trxId.trim())) {
        toast.error(lang === "bn" ? "সব ঘর পূরণ করুন।" : "Please fill all fields.");
        return;
      }
    } else {
      if (method === "bank") {
        if (!accName.trim() || !bankName.trim() || !accNumber.trim()) {
          toast.error(lang === "bn" ? "ব্যাংকের সব তথ্য দিন।" : "Fill all bank details."); return;
        }
      } else if (!sender.trim()) {
        toast.error(lang === "bn" ? "অ্যাকাউন্ট নাম্বার দিন।" : "Account number required."); return;
      }
    }

    setSubmitting(true);
    const payload = {
      user_id: user.id,
      type: mode,
      method,
      amount: amt,
      status: "pending" as const,
      sender_number: mode === "deposit" ? sender.trim() : (method !== "bank" ? sender.trim() : null),
      receiver_number: mode === "deposit" ? active.receive_number : null,
      external_txn_id: mode === "deposit" && method !== "bank" ? trxId.trim() : null,
      bank_account_name: method === "bank" ? accName.trim() || null : null,
      bank_account_number: method === "bank" ? accNumber.trim() || null : null,
      bank_name: method === "bank" ? bankName.trim() || null : null,
    };
    const { error } = await supabase.from("transactions").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("request_sent"));
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "deposit" ? t("add_cash") : t("withdraw")}</DialogTitle>
          <DialogDescription>
            {mode === "deposit"
              ? (lang === "bn" ? "টাকা পাঠিয়ে নিচের তথ্য দিন।" : "Send money then fill the details below.")
              : (lang === "bn" ? "যেখানে টাকা পেতে চান সেই তথ্য দিন।" : "Provide where you want to receive funds.")}
          </DialogDescription>
        </DialogHeader>

        {/* Method selector */}
        <div className="space-y-2">
          <Label>{t("payment_method")}</Label>
          <div className="grid grid-cols-4 gap-2">
            {mode === "deposit" && fincraEnabled && (
              <button
                type="button"
                onClick={() => setMethod("fincra")}
                className={`p-2 rounded-xl border text-center relative ${
                  method === "fincra" ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <div className="text-xl flex justify-center"><Zap className="h-5 w-5 text-primary" /></div>
                <div className="text-[10px] mt-0.5 font-medium">{lang === "bn" ? "অটো" : "Auto"}</div>
                <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-primary-foreground rounded px-1">{lang === "bn" ? "তাৎক্ষণিক" : "Instant"}</span>
              </button>
            )}
            {enabledList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setMethod(s.method)}
                className={`p-2 rounded-xl border text-center ${
                  method === s.method ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <div className="text-xl">{s.icon ?? "💳"}</div>
                <div className="text-[10px] mt-0.5 font-medium">{s.display_name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Receive info for deposit */}
        {mode === "deposit" && active && (
          <div className="rounded-xl border border-border bg-card/60 p-3 text-xs space-y-1.5">
            <div className="font-semibold text-primary">{t("important_notice")}</div>
            {active.receive_number && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("receive_number")}:</span>
                <button onClick={() => copy(active.receive_number!)} className="font-bold inline-flex items-center gap-1">
                  {active.receive_number} <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
            {active.instructions && <p className="text-muted-foreground leading-relaxed">{active.instructions}</p>}
            <div className="text-[11px] text-muted-foreground">
              {lang === "bn" ? "সীমা" : "Limit"}: {cur}{min} – {cur}{max}
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="space-y-1.5">
          <Label>{t("amount")}</Label>
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${min} – ${max}`} />
        </div>

        {/* Conditional fields */}
        {mode === "deposit" && method !== "bank" && (
          <>
            <div className="space-y-1.5">
              <Label>{t("sender_number")}</Label>
              <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("txn_id")}</Label>
              <Input value={trxId} onChange={(e) => setTrxId(e.target.value.toUpperCase())} placeholder="e.g. 8N7H2KQ91A" />
            </div>
          </>
        )}

        {mode === "withdraw" && method !== "bank" && (
          <div className="space-y-1.5">
            <Label>{lang === "bn" ? "আপনার " + (active?.display_name ?? "") + " নাম্বার" : `Your ${active?.display_name ?? ""} number`}</Label>
            <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
        )}

        {method === "bank" && mode === "withdraw" && (
          <>
            <div className="space-y-1.5">
              <Label>{t("account_name")}</Label>
              <Input value={accName} onChange={(e) => setAccName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "bn" ? "ব্যাংকের নাম" : "Bank name"}</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder={lang === "bn" ? "যেমনঃ DBBL" : "e.g. DBBL"} />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "bn" ? "অ্যাকাউন্ট নাম্বার" : "Account number"}</Label>
              <Input value={accNumber} onChange={(e) => setAccNumber(e.target.value)} placeholder="XXXXXXXXXXXX" />
            </div>
          </>
        )}

        {method === "bank" && mode === "deposit" && active?.instructions && (
          <p className="text-[11px] text-muted-foreground">{active.instructions}</p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting} className="flex-1">{t("cancel")}</Button>
          <Button onClick={submit} disabled={submitting} className="flex-1">{submitting ? t("submitting") : t("submit_request")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}