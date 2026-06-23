import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Wallet, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PaymentDialog } from "@/components/PaymentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { initFincraDeposit } from "@/lib/fincra.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/add-cash")({
  component: AddCashPage,
});

function AddCashPage() {
  const { lang } = useI18n();
  const c = useCurrency();
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [bal, setBal] = useState({ deposit: 0, winnings: 0 });
  const [qtEnabled, setQtEnabled] = useState(false);
  const [qtAmount, setQtAmount] = useState("");
  const [qtBusy, setQtBusy] = useState(false);
  const initQt = useServerFn(initFincraDeposit);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("balances")
      .select("deposit_balance, winnings_balance")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) =>
        data &&
        setBal({
          deposit: Number(data.deposit_balance) || 0,
          winnings: Number(data.winnings_balance) || 0,
        }),
      );
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "fincra")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data?.value ?? {}) as { enabled?: boolean };
        setQtEnabled(!!v.enabled);
      });
  }, [user]);

  const startQuickteller = async () => {
    const amt = Number(qtAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(lang === "bn" ? "সঠিক পরিমাণ দিন" : "Enter a valid amount");
      return;
    }
    setQtBusy(true);
    try {
      const res = await initQt({ data: { amount: amt } });
      // Redirect to Fincra hosted checkout
      window.location.href = res.checkout_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start payment");
      setQtBusy(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => nav({ to: "/wallet" })}
          className="h-9 w-9 rounded-full glass flex items-center justify-center"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{lang === "bn" ? "টাকা যোগ করুন" : "Add Cash"}</h1>
      </div>

      {qtEnabled && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <div className="font-bold text-sm">
              {lang === "bn" ? "অটো ডিপোজিট (Fincra)" : "Auto Deposit (Fincra)"}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn"
              ? "কার্ড বা ব্যাংকে পে করলে সাথে সাথে ব্যালেন্স যোগ হবে।"
              : "Pay with card or bank — balance credits automatically."}
          </p>
          <div>
            <Label className="text-[11px]">{lang === "bn" ? "পরিমাণ" : "Amount"}</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={qtAmount}
              onChange={(e) => setQtAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <Button className="w-full" onClick={startQuickteller} disabled={qtBusy}>
            <Zap className="h-4 w-4 mr-1" />
            {qtBusy
              ? lang === "bn" ? "শুরু হচ্ছে…" : "Starting…"
              : lang === "bn" ? "Fincra এ পে করুন" : "Pay with Fincra"}
          </Button>
        </Card>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-xs text-muted-foreground underline underline-offset-4"
      >
        {lang === "bn" ? "ম্যানুয়াল মেথড ব্যবহার করুন" : "Use a manual method"}
      </button>

      <form ref={formRef} style={{ display: "none" }} />

      <PaymentDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
        }}
        mode="deposit"
        onSuccess={() => nav({ to: "/wallet" })}
      />
    </div>
  );
}
